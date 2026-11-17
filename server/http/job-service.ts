import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Pool } from 'pg';
import { paidProductionInput } from './production-entitlement.ts';
import type { PresentationContent } from '../../shared/presentation.ts';

export interface JobRow {
  id: string;
  project_id: string;
  owner_id: string;
  design_spec_id: string;
  entitlement_id: string;
  attempts: number;
  max_attempts: number;
  [key: string]: unknown;
}

export class LeaseLost extends Error {
  constructor() { super('JOB_LEASE_LOST'); }
}

export interface RenderInput { title: string; slideCount: number; languageMode: string;
  content?:PresentationContent; previewSource?:{id:string;key:string;sha256:string} }
export interface JobDependencies {
  generate(input: RenderInput, output: string, signal: AbortSignal): Promise<void>;
  validate(output: string, input: RenderInput, signal: AbortSignal): Promise<Record<string, unknown>>;
  upload(job: JobRow, filename: string, bytes: Buffer, signal: AbortSignal): Promise<{ storageKey: string }>;
}

// attempts is a monotonically increasing fencing generation. Never reset it on retries.
const OWNED = "id = $1 AND attempts = $2 AND status = 'running' AND lease_expires_at > clock_timestamp()";
const CLAIMABLE = `attempts < max_attempts AND job_type = 'pptx_production' AND (
  status = 'queued'
  OR (status = 'running' AND lease_expires_at < clock_timestamp())
  OR (status = 'failed' AND next_retry_at <= clock_timestamp())
)`;
const FAILURE_CODES = new Set(['PROCESS_TIMEOUT', 'PROCESS_OUTPUT_LIMIT', 'PROCESS_START_FAILED',
  'PROCESS_FAILED', 'PROCESS_INVALID_JSON', 'JOB_CANCELLED', 'PRODUCTION_SNAPSHOT_MISMATCH',
  'OUTPUT_VALIDATION_FAILED', 'WORKER_STORAGE_CREDENTIALS_MISSING']);

export function createJobService(db: Pool, dependencies: JobDependencies,
  options: { leaseSeconds?: number; heartbeatMs?: number } = {}) {
  const leaseSeconds = options.leaseSeconds ?? 120;
  const heartbeatMs = options.heartbeatMs ?? 30_000;

  async function claimNextAvailableJob(jobId?: string): Promise<JobRow | null> {
    const targetFilter = jobId ? 'AND id = $1' : '';
    const targetValues = jobId ? [jobId] : [];
    const leaseParameter = jobId ? '$2' : '$1';
    const parameters = jobId ? [jobId, leaseSeconds] : [leaseSeconds];
    // A crash on the last attempt must not create an infinitely reclaimable job.
    await db.query(`UPDATE ai_presentation.jobs SET status = 'quarantined',
      error_code = 'ATTEMPTS_EXHAUSTED', error_message = 'Production retry limit reached.',
      lease_expires_at = NULL, next_retry_at = NULL
      WHERE job_type = 'pptx_production' AND attempts >= max_attempts AND (status IN ('queued', 'failed')
        OR (status = 'running' AND lease_expires_at < clock_timestamp())) ${targetFilter}`, targetValues);
    const result = await db.query(`UPDATE ai_presentation.jobs SET status = 'running',
      attempts = attempts + 1, lease_expires_at = clock_timestamp() + (${leaseParameter} * INTERVAL '1 second'),
      next_retry_at = NULL, error_code = NULL, error_message = NULL,
      started_at = COALESCE(started_at, clock_timestamp())
      WHERE id = (SELECT id FROM ai_presentation.jobs WHERE ${CLAIMABLE}
        ${targetFilter} ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`, parameters);
    return result.rows[0] ?? null;
  }

  async function renew(job: JobRow): Promise<void> {
    const result = await db.query(`UPDATE ai_presentation.jobs
      SET lease_expires_at = clock_timestamp() + ($3 * INTERVAL '1 second')
      WHERE ${OWNED} RETURNING id`, [job.id, job.attempts, leaseSeconds]);
    if (result.rowCount !== 1) throw new LeaseLost();
  }

  async function executeClaimedJob(job: JobRow): Promise<void> {
    const controller = new AbortController();
    let heartbeat: Promise<void> | undefined;
    let leaseError: unknown;
    let tempDir: string | undefined;
    const timer = setInterval(() => {
      if (heartbeat || leaseError) return;
      heartbeat = renew(job).catch((error: unknown) => {
        leaseError = error;
        controller.abort();
      }).finally(() => { heartbeat = undefined; });
    }, heartbeatMs);
    const progress = async (stage: string) => {
      if (leaseError) throw new LeaseLost();
      const result = await db.query(`UPDATE ai_presentation.jobs SET progress_stage = $3
        WHERE ${OWNED} RETURNING id`, [job.id, job.attempts, stage]);
      if (result.rowCount !== 1) throw new LeaseLost();
    };

    try {
      await progress('Checking production entitlement');
      const refs = { projectId: job.project_id, specId: job.design_spec_id,
        entitlementId: job.entitlement_id, ownerId: job.owner_id };
      const input = await paidProductionInput(db, refs);
      if (!input) throw new Error('PRODUCTION_SNAPSHOT_MISMATCH');
      tempDir = await mkdtemp(path.join(tmpdir(), 'ai-presentation-'));
      // Attempt-specific keys prevent an obsolete worker from overwriting the winner.
      const filename = `${job.id}-${job.attempts}-${randomUUID()}.pptx`;
      const output = path.join(tempDir, filename);
      await progress('Generating static deck');
      await dependencies.generate(input, output, controller.signal);
      await progress('Validating static deck');
      const validation = await dependencies.validate(output, input, controller.signal);
      if (validation.passed !== true) throw new Error('OUTPUT_VALIDATION_FAILED');
      const bytes = await readFile(output);
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if(input.previewSource&&checksum!==input.previewSource.sha256)throw new Error('PRODUCTION_SNAPSHOT_MISMATCH');
      await progress('Uploading to private storage');
      const { storageKey } = await dependencies.upload(job, filename, bytes, controller.signal);
      if (leaseError) throw new LeaseLost();

      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM ai_presentation.projects WHERE id=$1 FOR UPDATE',[job.project_id]);
        // Lock + fence before registering an asset. No asset is downloadable on lease loss.
        const owned = await client.query(`SELECT id FROM ai_presentation.jobs WHERE ${OWNED} FOR UPDATE`, [job.id, job.attempts]);
        if (owned.rowCount !== 1) throw new LeaseLost();
        if (!await paidProductionInput(client, refs)) throw new Error('PRODUCTION_SNAPSHOT_MISMATCH');
        const asset = await client.query(`INSERT INTO ai_presentation.generated_assets
          (project_id, job_id, owner_id, asset_type, storage_bucket, storage_key, filename,
           mime_type, size_bytes, sha256_checksum, is_quarantined)
          VALUES ($1, $2, $3, 'pptx_deck', 'private-presentations', $4, $5,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', $6, $7, FALSE)
          RETURNING id`, [job.project_id, job.id, job.owner_id, storageKey, filename, bytes.length, checksum]);
        const done = await client.query(`UPDATE ai_presentation.jobs SET status = 'completed',
          completed_at = clock_timestamp(), output_asset_id = $3, progress_stage = 'Delivered',
          animation_choices = $4, validation_report = $5, lease_expires_at = NULL, next_retry_at = NULL
          WHERE ${OWNED} RETURNING id`, [job.id, job.attempts, asset.rows[0].id,
          JSON.stringify({ tier: 'static', transition: null, entrances: [] }), JSON.stringify(validation)]);
        if (done.rowCount !== 1) throw new LeaseLost();
        await client.query("UPDATE ai_presentation.projects SET state='delivered',updated_at=now() WHERE id=$1",[job.project_id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    } catch (error) {
      // Fail only our own still-live generation. An obsolete attempt cannot poison a retry.
      if (!(error instanceof LeaseLost) && !leaseError) {
        const finalAttempt = job.attempts >= job.max_attempts;
        await db.query(`UPDATE ai_presentation.jobs SET status = $3, error_code = $4,
          error_message = 'Production failed. Retry or contact support if the failure persists.',
          next_retry_at = CASE WHEN $5 THEN NULL ELSE clock_timestamp() + ($6 * INTERVAL '1 second') END,
          lease_expires_at = NULL WHERE ${OWNED}`,
          [job.id, job.attempts, finalAttempt ? 'quarantined' : 'failed',
            error instanceof Error && FAILURE_CODES.has(error.message) ? error.message : 'GENERATION_FAILED',
            finalAttempt, 30 * 2 ** Math.max(0, job.attempts - 1)]);
      }
      throw leaseError ? new LeaseLost() : error;
    } finally {
      clearInterval(timer);
      await heartbeat;
      controller.abort();
      if (tempDir) await rm(tempDir, { recursive: true, force: true });
    }
  }
  return { claimNextAvailableJob, executeClaimedJob, renew };
}
