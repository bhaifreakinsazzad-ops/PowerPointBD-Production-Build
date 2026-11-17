import { Router } from 'express';
import { randomUUID,createHash } from 'node:crypto';
import { withUserContext } from '../db.ts';
import { asyncRoute, ApiError } from '../errors.ts';
import { rejectForbiddenClientFields, requireIntInRange, requireString } from '../validation.ts';
import { createSignedDownloadUrl } from '../storage.ts';

export function createPreviewsRouter(context=withUserContext, signedUrl=createSignedDownloadUrl) {
  const router=Router();
  router.param('id',(_req,_res,next,id:string)=>{
    next(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?undefined:new ApiError(400,'INVALID_PROJECT_ID','A valid project ID is required.'));
  });
  router.post('/projects/:id/previews',asyncRoute(async(req,res)=>{
    const body=rejectForbiddenClientFields(req.body);
    const version=requireIntInRange(body,'content_version',1,2147483646);
    const key=requireString(body,'idempotency_key',{maxLength:128});
    const data=await context(req.user!.id,async(db)=>{
      const project=(await db.query('SELECT * FROM ai_presentation.projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[req.params.id,req.user!.id])).rows[0];
      if(!project)throw new ApiError(404,'PROJECT_NOT_FOUND','Project not found.');
      const prior=(await db.query(`SELECT j.*,r.content_version FROM ai_presentation.jobs j
        JOIN ai_presentation.preview_requests r ON r.job_id=j.id WHERE j.idempotency_key=$1`,[key])).rows[0];
      if(prior){
        if(prior.project_id!==project.id || prior.content_version!==version)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This request key has already been used.');
        return {job:prior,replay:true};
      }
      if(!['draft','preview_ready','preview_revision_requested','design_review'].includes(project.state))throw new ApiError(409,'INVALID_PROJECT_STATE','This project cannot request previews in its current state.');
      const current=(await db.query('SELECT version FROM ai_presentation.content_drafts WHERE project_id=$1 ORDER BY version DESC LIMIT 1',[project.id])).rows[0];
      if(current?.version!==version)throw new ApiError(409,'CONTENT_VERSION_CONFLICT','Save and preview the latest content version.');
      if((await db.query("SELECT 1 FROM ai_presentation.jobs WHERE project_id=$1 AND job_type='static_preview' AND status IN('queued','running','failed') LIMIT 1",[project.id])).rowCount)throw new ApiError(409,'PREVIEW_ALREADY_PENDING','A preview request is already pending.');
      const result=await db.query(`INSERT INTO ai_presentation.jobs(id,project_id,owner_id,job_type,idempotency_key)
        VALUES($1,$2,$3,'static_preview',$4) ON CONFLICT(idempotency_key) DO NOTHING RETURNING *`,[randomUUID(),project.id,req.user!.id,key]);
      if(!result.rowCount)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This request key has already been used.');
      const job=result.rows[0];
      await db.query('INSERT INTO ai_presentation.preview_requests(job_id,project_id,owner_id,content_version) VALUES($1,$2,$3,$4)',[job.id,project.id,req.user!.id,version]);
      await db.query("UPDATE ai_presentation.projects SET state='preview_queued',updated_at=now() WHERE id=$1",[project.id]);
      return {job,replay:false};
    });
    res.status(data.replay?200:202).json({ok:true,data});
  }));
  router.get('/projects/:id/previews',asyncRoute(async(req,res)=>{
    const data=await context(req.user!.id,async(db)=>{
      if(!(await db.query('SELECT id FROM ai_presentation.projects WHERE id=$1 AND owner_id=$2',[req.params.id,req.user!.id])).rowCount)throw new ApiError(404,'PROJECT_NOT_FOUND','Project not found.');
      const preview=(await db.query(`SELECT r.*,j.status,j.error_code,j.attempts FROM ai_presentation.preview_requests r
        JOIN ai_presentation.jobs j ON j.id=r.job_id WHERE r.project_id=$1 ORDER BY r.created_at DESC,r.job_id DESC LIMIT 1`,[req.params.id])).rows[0];
      if(!preview)return {preview:null};
      const assets=preview.status==='completed'?(await db.query(`SELECT id,storage_key,filename FROM ai_presentation.generated_assets
        WHERE job_id=$1 AND owner_id=$2 AND asset_type='preview_image' AND NOT is_quarantined ORDER BY filename`,[preview.job_id,req.user!.id])).rows:[];
      const approval=(await db.query('SELECT preview_job_id,content_version,approved_at FROM ai_presentation.preview_approvals WHERE project_id=$1',[req.params.id])).rows[0]??null;
      return {preview:{...preview,manifest_sha256:preview.render_manifest?createHash('sha256').update(JSON.stringify(preview.render_manifest)).digest('hex'):null},pages:assets,approval};
    });
    const pages='pages' in data?await Promise.all((data.pages??[]).map(async(page)=>({id:page.id,url:await signedUrl(req.user!.accessToken,page.storage_key,300)}))):[];
    res.setHeader('Cache-Control','no-store');res.json({ok:true,data:{...data,pages}});
  }));
  router.post('/projects/:id/preview-revision',asyncRoute(async(req,res)=>{
    rejectForbiddenClientFields(req.body??{});
    const project=await context(req.user!.id,async(db)=>{
      const row=(await db.query('SELECT * FROM ai_presentation.projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[req.params.id,req.user!.id])).rows[0];
      if(!row)throw new ApiError(404,'PROJECT_NOT_FOUND','Project not found.');
      if(!['preview_ready','preview_revision_requested'].includes(row.state))throw new ApiError(409,'INVALID_PROJECT_STATE','This project cannot open a preview revision.');
      if(row.preview_revisions_used>=2)throw new ApiError(409,'PREVIEW_REVISION_LIMIT','The two included revision rounds have been consumed.');
      return (await db.query("UPDATE ai_presentation.projects SET state='preview_revision_requested',updated_at=now() WHERE id=$1 RETURNING *",[row.id])).rows[0];
    });
    res.json({ok:true,data:{project}});
  }));
  router.post('/projects/:id/approve-preview',asyncRoute(async(req,res)=>{
    const body=rejectForbiddenClientFields(req.body);
    const version=requireIntInRange(body,'content_version',1,2147483646);
    const previewId=requireString(body,'preview_job_id',{maxLength:36});
    const digest=requireString(body,'manifest_sha256',{maxLength:64});
    if(body.confirmed!==true||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(previewId)||!/^[0-9a-f]{64}$/.test(digest))throw new ApiError(400,'APPROVAL_CONFIRMATION_REQUIRED','Confirm approval of the exact rendered preview.');
    const data=await context(req.user!.id,async(db)=>{
      const project=(await db.query('SELECT state FROM ai_presentation.projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[req.params.id,req.user!.id])).rows[0];
      if(!project)throw new ApiError(404,'PROJECT_NOT_FOUND','Project not found.');
      const preview=(await db.query(`SELECT r.*,j.status FROM ai_presentation.preview_requests r JOIN ai_presentation.jobs j ON j.id=r.job_id
        WHERE r.project_id=$1 ORDER BY r.created_at DESC,r.job_id DESC LIMIT 1`,[req.params.id])).rows[0];
      const latest=(await db.query('SELECT max(version) AS version FROM ai_presentation.content_drafts WHERE project_id=$1',[req.params.id])).rows[0];
      if(!preview||preview.job_id!==previewId||preview.status!=='completed'||preview.content_version!==version||latest.version!==version
        ||!preview.render_manifest||createHash('sha256').update(JSON.stringify(preview.render_manifest)).digest('hex')!==digest)throw new ApiError(409,'PREVIEW_SNAPSHOT_MISMATCH','The preview or saved content has changed. Reload the current images before approving.');
      const prior=(await db.query('SELECT * FROM ai_presentation.preview_approvals WHERE project_id=$1',[req.params.id])).rows[0];
      if(prior){
        if(prior.preview_job_id!==previewId||prior.content_version!==version)throw new ApiError(409,'DESIGN_ALREADY_APPROVED','Another preview has already been approved.');
        return {approval:prior,replay:true};
      }
      if(project.state!=='preview_ready')throw new ApiError(409,'PREVIEW_NOT_APPROVABLE','This project is not ready for design approval.');
      let approval;
      try{
        approval=(await db.query(`INSERT INTO ai_presentation.preview_approvals(project_id,owner_id,preview_job_id,content_version,render_manifest)
          VALUES($1,$2,$3,$4,$5) RETURNING *`,[req.params.id,req.user!.id,previewId,version,JSON.stringify(preview.render_manifest)])).rows[0];
      }catch(error){
        if(error instanceof Error&&error.message.includes('PREVIEW_NOT_APPROVABLE'))throw new ApiError(409,'PREVIEW_NOT_APPROVABLE','Preview assets are unavailable or quarantined. Refresh the preview before approval.');
        throw error;
      }
      await db.query("UPDATE ai_presentation.projects SET state='design_approved',updated_at=now() WHERE id=$1",[req.params.id]);
      return {approval,replay:false};
    });
    res.status(data.replay?200:201).json({ok:true,data});
  }));
  return router;
}
export const previewsRouter=createPreviewsRouter();
