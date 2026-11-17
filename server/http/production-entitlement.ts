import type { Pool } from 'pg';
import type { RenderInput } from './job-service.ts';
import { approvedContent,matchesApprovedSpec } from './approved-content.ts';
import { env } from './env.ts';

/** Verify the entire paid chain, then read render inputs only from the locked spec. */
export async function paidProductionInput(db: Pick<Pool, 'query'>, refs: {
  projectId: string; specId: string; entitlementId: string; ownerId: string;
}): Promise<RenderInput | null> {
  // Until a real provider is selected/verified, production must not reuse
  // mock entitlements left over from a development or staging database.
  if(env.NODE_ENV==='production')return null;
  const result = await db.query(`SELECT s.spec_json->>'title' AS title,
      s.spec_json->>'language_mode' AS language_mode,
      (s.spec_json->>'slide_count')::integer AS slide_count,s.spec_json
    FROM ai_presentation.projects p
    JOIN ai_presentation.design_specs s ON s.id = $2 AND s.project_id = p.id
    JOIN ai_presentation.entitlements e ON e.id = $3 AND e.project_id = p.id
    JOIN ai_presentation.payments pay ON pay.id = e.payment_id AND pay.project_id = p.id
    JOIN ai_presentation.quotes q ON q.id = pay.quote_id AND q.project_id = p.id
    WHERE p.id = $1 AND p.state <> 'cancelled' AND p.owner_id = $4 AND e.owner_id = $4 AND pay.owner_id = $4 AND q.owner_id = $4
      AND e.status = 'active' AND e.design_spec_id = s.id AND q.design_spec_id = s.id AND s.is_locked
      AND e.motion_tier = 'static' AND q.tier = 'static' AND pay.tier = 'static'
      AND s.spec_json->>'motion_tier' = 'static'
      AND pay.status = 'verified' AND pay.webhook_signature_verified AND q.status = 'paid'
      AND pay.currency = 'BDT' AND q.quote_amount = pay.quote_amount
      AND q.quote_amount_paisa = pay.quote_amount_paisa
      AND q.quote_amount_paisa = q.quote_amount::bigint * 100
      AND pay.quote_amount_paisa = pay.quote_amount::bigint * 100
      AND q.quote_breakdown = pay.quote_breakdown
      AND q.slide_count = (s.spec_json->>'slide_count')::integer
      AND length(s.spec_json->>'title') BETWEEN 1 AND 200
      AND s.spec_json->>'language_mode' IN ('bn','en','bilingual')`,
    [refs.projectId, refs.specId, refs.entitlementId, refs.ownerId]);
  const row = result.rows[0];
  if (!row || !Number.isInteger(row.slide_count) || row.slide_count < 1 || row.slide_count > 100) return null;
  if(row.spec_json.content){
    const approved=await approvedContent(db,refs.projectId,refs.ownerId);
    if(!approved||!matchesApprovedSpec(row.spec_json,approved))return null;
    return {title:row.title,slideCount:row.slide_count,languageMode:row.language_mode,content:approved.content,previewSource:approved.source};
  }
  // A versioned customer project cannot fall back to legacy placeholder inputs.
  if((await db.query('SELECT 1 FROM ai_presentation.content_drafts WHERE project_id=$1 LIMIT 1',[refs.projectId])).rowCount)return null;
  return { title: row.title, slideCount: row.slide_count, languageMode: row.language_mode };
}
