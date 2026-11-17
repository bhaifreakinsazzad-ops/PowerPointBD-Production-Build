import type { Pool } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { validatePresentation, type PresentationContent } from '../../shared/presentation.ts';
import type { PreviewRender } from './preview-renderer.ts';
import { LeaseLost } from './job-service.ts';

interface PreviewJob { id:string; project_id:string; owner_id:string; attempts:number; max_attempts:number }
interface Upload { name:string; bytes:Buffer; mime:string; type:'pptx_deck'|'preview_image' }
export function createPreviewService(db:Pool,dependencies:{
  render(content:PresentationContent,signal:AbortSignal):Promise<PreviewRender>;
  upload(job:PreviewJob,file:Upload,signal:AbortSignal):Promise<{storageKey:string}>;
},options:{leaseSeconds?:number;heartbeatMs?:number}={}) {
  const lease=options.leaseSeconds??120, heartbeatMs=options.heartbeatMs??30000;
  const owned="id=$1 AND attempts=$2 AND status='running' AND lease_expires_at>clock_timestamp()";
  async function claim():Promise<PreviewJob|null> {
    await db.query(`WITH locked AS MATERIALIZED (SELECT p.id FROM ai_presentation.projects p WHERE EXISTS(
      SELECT 1 FROM ai_presentation.jobs j WHERE j.project_id=p.id AND j.job_type='static_preview'
        AND j.attempts>=j.max_attempts AND (j.status IN('queued','failed')
          OR(j.status='running' AND j.lease_expires_at<clock_timestamp())))
      LIMIT 100 FOR UPDATE OF p SKIP LOCKED), exhausted AS (UPDATE ai_presentation.jobs SET status='quarantined',
      error_code='ATTEMPTS_EXHAUSTED',lease_expires_at=NULL,next_retry_at=NULL
      WHERE project_id IN(SELECT id FROM locked) AND job_type='static_preview' AND attempts>=max_attempts AND (status IN('queued','failed')
        OR (status='running' AND lease_expires_at<clock_timestamp())) RETURNING project_id)
      UPDATE ai_presentation.projects SET state='preview_revision_requested',updated_at=now()
      WHERE state='preview_queued' AND id IN(SELECT project_id FROM exhausted)`);
    const result=await db.query(`UPDATE ai_presentation.jobs SET status='running',attempts=attempts+1,
      lease_expires_at=clock_timestamp()+($1*INTERVAL '1 second'),next_retry_at=NULL,error_code=NULL,error_message=NULL,
      started_at=coalesce(started_at,clock_timestamp()) WHERE id=(SELECT id FROM ai_presentation.jobs
        WHERE job_type='static_preview' AND attempts<max_attempts AND (status='queued'
          OR(status='running' AND lease_expires_at<clock_timestamp()) OR(status='failed' AND next_retry_at<=clock_timestamp()))
        ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[lease]);
    return result.rows[0]??null;
  }
  async function execute(job:PreviewJob) {
    const abort=new AbortController();let lost=false,renewal:Promise<void>|undefined;
    const timer=setInterval(()=>{
      if(renewal||lost)return;
      renewal=db.query(`UPDATE ai_presentation.jobs SET lease_expires_at=clock_timestamp()+($3*INTERVAL '1 second')
        WHERE ${owned} RETURNING id`,[job.id,job.attempts,lease]).then(result=>{
          if(result.rowCount!==1)throw new LeaseLost();
        }).catch(()=>{lost=true;abort.abort();}).finally(()=>{renewal=undefined;});
    },heartbeatMs);
    try {
      const client=await db.connect();let content:PresentationContent;
      try {
        await client.query('BEGIN');
        // Same owner lock serializes starts across DIFFERENT projects.
        const user=(await client.query('SELECT free_preview_projects_used FROM ai_presentation.users WHERE id=$1 FOR UPDATE',[job.owner_id])).rows[0];
        const project=(await client.query('SELECT state,preview_revisions_used FROM ai_presentation.projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[job.project_id,job.owner_id])).rows[0];
        if(!(await client.query(`SELECT id FROM ai_presentation.jobs WHERE ${owned} FOR UPDATE`,[job.id,job.attempts])).rowCount)throw new LeaseLost();
        const preview=(await client.query(`SELECT r.*,d.content FROM ai_presentation.preview_requests r JOIN ai_presentation.content_drafts d
          ON d.project_id=r.project_id AND d.version=r.content_version WHERE r.job_id=$1 AND r.owner_id=$2 FOR UPDATE OF r`,[job.id,job.owner_id])).rows[0];
        if(!user||!project||!preview||project.state!=='preview_queued')throw new Error('PREVIEW_SNAPSHOT_MISMATCH');
        content=validatePresentation(preview.content);
        if(!preview.charged_at){
          const previous=(await client.query('SELECT 1 FROM ai_presentation.preview_requests WHERE project_id=$1 AND charged_at IS NOT NULL LIMIT 1',[job.project_id])).rowCount;
          if(previous){
            if(project.preview_revisions_used>=2)throw new Error('PREVIEW_REVISION_LIMIT');
            await client.query('UPDATE ai_presentation.projects SET preview_revisions_used=preview_revisions_used+1,updated_at=now() WHERE id=$1',[job.project_id]);
          }else{
            if(user.free_preview_projects_used>=2)throw new Error('PREVIEW_PROJECT_LIMIT');
            await client.query('UPDATE ai_presentation.users SET free_preview_projects_used=free_preview_projects_used+1,updated_at=now() WHERE id=$1',[job.owner_id]);
          }
          await client.query('UPDATE ai_presentation.preview_requests SET charged_at=clock_timestamp() WHERE job_id=$1',[job.id]);
        }
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}
      finally{client.release();}
      const rendered=await dependencies.render(content,abort.signal);
      if(lost)throw new LeaseLost();
      if(rendered.pages.length!==content.slides.length||rendered.manifest.slide_count!==content.slides.length
        ||rendered.manifest.template!=='corporate_slate-v1'||rendered.manifest.pptx_sha256!==createHash('sha256').update(rendered.deck).digest('hex')
        ||rendered.manifest.page_sha256.length!==rendered.pages.length
        ||rendered.pages.some((bytes,i)=>createHash('sha256').update(bytes).digest('hex')!==rendered.manifest.page_sha256[i]))throw new Error('PREVIEW_PACKAGE_INVALID');
      const prefix=`preview-${job.id}-${job.attempts}-${randomUUID()}`;
      const files:Upload[]=[{name:`${prefix}.pptx`,bytes:rendered.deck,mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation',type:'pptx_deck'},
        ...rendered.pages.map((bytes,index)=>({name:`${prefix}-${String(index+1).padStart(3,'0')}.png`,bytes,mime:'image/png',type:'preview_image' as const}))];
      const uploads=[];
      for(const file of files){if(lost)throw new LeaseLost();uploads.push({...file,...await dependencies.upload(job,file,abort.signal)});}
      const final=await db.connect();
      try {
        await final.query('BEGIN');
        // Project first is consistent with enqueue/edit locks, then the job fence.
        const project=(await final.query('SELECT state FROM ai_presentation.projects WHERE id=$1 FOR UPDATE',[job.project_id])).rows[0];
        if(project?.state!=='preview_queued')throw new Error('PREVIEW_SNAPSHOT_MISMATCH');
        if(!(await final.query(`SELECT id FROM ai_presentation.jobs WHERE ${owned} FOR UPDATE`,[job.id,job.attempts])).rowCount)throw new LeaseLost();
        const assetIds:string[]=[];
        for(const file of uploads){
          const result=await final.query(`INSERT INTO ai_presentation.generated_assets(project_id,job_id,owner_id,asset_type,storage_bucket,storage_key,filename,mime_type,size_bytes,sha256_checksum)
            VALUES($1,$2,$3,$4,'private-presentations',$5,$6,$7,$8,$9) RETURNING id`,[job.project_id,job.id,job.owner_id,file.type,file.storageKey,file.name,file.mime,file.bytes.length,createHash('sha256').update(file.bytes).digest('hex')]);
          assetIds.push(result.rows[0].id);
        }
        await final.query('UPDATE ai_presentation.preview_requests SET render_manifest=$2 WHERE job_id=$1',[job.id,JSON.stringify({...rendered.manifest,source_asset_id:assetIds[0],page_asset_ids:assetIds.slice(1)})]);
        const completed=await final.query(`UPDATE ai_presentation.jobs SET status='completed',completed_at=now(),lease_expires_at=NULL,
          progress_stage='Preview ready',output_asset_id=$3,validation_report=$4 WHERE ${owned}`,[job.id,job.attempts,assetIds[0],JSON.stringify({passed:true,scope:'rendered-static-preview',desktop_powerpoint:'UNVERIFIED'})]);
        if(completed.rowCount!==1)throw new LeaseLost();
        await final.query("UPDATE ai_presentation.projects SET state='preview_ready',updated_at=now() WHERE id=$1 AND state='preview_queued'",[job.project_id]);
        await final.query('COMMIT');
      }catch(error){await final.query('ROLLBACK');throw error;}
      finally{final.release();}
    }catch(error){
      if(!lost&&!(error instanceof LeaseLost)){
        const code=error instanceof Error?error.message:'';
        const quota=['PREVIEW_PROJECT_LIMIT','PREVIEW_REVISION_LIMIT'].includes(code);
        const terminal=quota||job.attempts>=job.max_attempts;
        const safe=['PREVIEW_PROJECT_LIMIT','PREVIEW_REVISION_LIMIT','PREVIEW_PACKAGE_INVALID','PREVIEW_RENDERER_UNAVAILABLE','PREVIEW_RENDERER_STARTUP_TIMEOUT',
          'PREVIEW_GENERATION_TIMEOUT','PREVIEW_VALIDATION_TIMEOUT','PREVIEW_STARTUP_TIMEOUT','PREVIEW_CONVERSION_TIMEOUT','PREVIEW_RASTERIZATION_TIMEOUT',
          'PREVIEW_SNAPSHOT_MISMATCH','WORKER_STORAGE_CREDENTIALS_MISSING','PROCESS_TIMEOUT'].includes(code)?code:'PREVIEW_RENDER_FAILED';
        await db.query(`WITH locked AS MATERIALIZED (SELECT id FROM ai_presentation.projects WHERE id=$7 FOR UPDATE),
          failed AS (UPDATE ai_presentation.jobs SET status=$3,error_code=$4,
          error_message='Preview rendering did not complete. Review the recorded status before requesting another render.',
          lease_expires_at=NULL,next_retry_at=CASE WHEN $5 THEN NULL ELSE clock_timestamp()+($6*INTERVAL '1 second') END
          WHERE project_id IN(SELECT id FROM locked) AND ${owned} RETURNING project_id)
          UPDATE ai_presentation.projects SET state='preview_revision_requested',updated_at=now()
          WHERE $5 AND state='preview_queued' AND id IN(SELECT project_id FROM failed)`,[job.id,job.attempts,terminal?'quarantined':'failed',safe,terminal,30*2**(job.attempts-1),job.project_id]);
      }
      throw lost?new LeaseLost():error;
    }finally{clearInterval(timer);await renewal;abort.abort();}
  }
  return {claim,execute};
}
