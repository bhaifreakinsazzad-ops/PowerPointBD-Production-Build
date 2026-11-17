import type { Pool } from 'pg';
import { isDeepStrictEqual } from 'node:util';
import { validatePresentation, type PresentationContent } from '../../shared/presentation.ts';

export interface ApprovedContent {
  content:PresentationContent; version:number; previewJobId:string;
  source:{id:string;key:string;sha256:string}; manifest:Record<string,unknown>;
}
/** Approval is insufficient if a source/image has since been quarantined. */
export async function approvedContent(db:Pick<Pool,'query'>,projectId:string,ownerId:string):Promise<ApprovedContent|null>{
  const result=await db.query(`SELECT ap.content_version,ap.preview_job_id,ap.render_manifest,d.content,
      a.id AS source_id,a.storage_key,a.sha256_checksum
    FROM ai_presentation.preview_approvals ap
    JOIN ai_presentation.content_drafts d ON d.project_id=ap.project_id AND d.version=ap.content_version
    JOIN ai_presentation.preview_requests r ON r.job_id=ap.preview_job_id AND r.project_id=ap.project_id AND r.owner_id=ap.owner_id
    JOIN ai_presentation.jobs j ON j.id=r.job_id AND j.status='completed' AND j.validation_report->>'passed'='true'
    JOIN ai_presentation.generated_assets a ON a.id=(ap.render_manifest->>'source_asset_id')::uuid
      AND a.project_id=ap.project_id AND a.owner_id=ap.owner_id AND a.job_id=r.job_id AND a.asset_type='pptx_deck'
      AND a.is_private AND NOT a.is_quarantined AND a.sha256_checksum=ap.render_manifest->>'pptx_sha256'
    WHERE ap.project_id=$1 AND ap.owner_id=$2 AND ap.render_manifest=r.render_manifest
      AND ap.content_version=(SELECT max(version) FROM ai_presentation.content_drafts WHERE project_id=$1)
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(ap.render_manifest->'page_asset_ids') WITH ORDINALITY AS pages(id,position)
        WHERE NOT EXISTS(SELECT 1 FROM ai_presentation.generated_assets image WHERE image.id=pages.id::uuid AND image.job_id=j.id
          AND image.owner_id=$2 AND image.project_id=$1 AND image.asset_type='preview_image' AND image.is_private AND NOT image.is_quarantined
          AND image.sha256_checksum=ap.render_manifest->'page_sha256'->>(pages.position::integer-1)))`,[projectId,ownerId]);
  const row=result.rows[0];if(!row)return null;
  try{
    const content=validatePresentation(row.content);
    if(content.slides.length!==row.render_manifest.slide_count||row.render_manifest.template!=='corporate_slate-v1')return null;
    return {content,version:row.content_version,previewJobId:row.preview_job_id,manifest:row.render_manifest,
      source:{id:row.source_id,key:row.storage_key,sha256:row.sha256_checksum}};
  }catch{return null;}
}
export function approvedSpecFields(snapshot:ApprovedContent){
  return {content:snapshot.content,content_version:snapshot.version,approved_preview_job_id:snapshot.previewJobId,
    preview_source_asset_id:snapshot.source.id,preview_source_sha256:snapshot.source.sha256,preview_manifest:snapshot.manifest,
    title:snapshot.content.title,language_mode:snapshot.content.language,slide_count:snapshot.content.slides.length};
}
export function matchesApprovedSpec(spec:Record<string,unknown>,snapshot:ApprovedContent){
  return Object.entries(approvedSpecFields(snapshot)).every(([key,value])=>isDeepStrictEqual(spec[key],value));
}
