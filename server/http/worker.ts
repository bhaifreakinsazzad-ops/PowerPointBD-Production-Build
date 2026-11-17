/** Standalone durable worker. Run separately from the enqueue-only HTTP API. */
import { claimNextAvailableJob, executeClaimedJob } from './jobs.ts';
import { claimPreview,executePreview } from './preview-jobs.ts';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export async function runOneTick(jobId?: string): Promise<'claimed' | 'empty'> {
  if (jobId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    throw new Error('INVALID_WORKER_JOB_ID');
  }
  const job = await claimNextAvailableJob(jobId);
  if (!job) {
    // A scoped recovery/test tick must never fall through to an unrelated
    // preview job when its requested production job is not claimable.
    if (jobId) return 'empty';
    const preview=await claimPreview();
    if(!preview)return 'empty';
    try{await executePreview(preview);console.log(`[worker] preview ${preview.id} completed`);}
    catch{console.error(`[worker] preview ${preview.id} did not complete; inspect its recorded status.`);}
    return 'claimed';
  }
  try {
    await executeClaimedJob(job);
    console.log(`[worker] job ${job.id} completed`);
  } catch {
    // Error details can contain provider/customer data; durable errors are sanitized.
    console.error(`[worker] job ${job.id} did not complete; inspect its recorded status.`);
  }
  return 'claimed';
}

export async function runWorkerLoop(): Promise<void> {
  console.log('AI Presentation Platform background worker starting.');
  for (;;) {
    const outcome = await runOneTick().catch(() => {
      console.error('[worker] tick failed; retrying.');
      return 'empty' as const;
    });
    await new Promise((resolve) => setTimeout(resolve, outcome === 'claimed' ? 250 : 5000));
  }
}
const isMain = process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if (isMain) void runWorkerLoop();
