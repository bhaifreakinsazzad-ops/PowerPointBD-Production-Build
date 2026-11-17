import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { env } from './env.ts';
import { workerPool } from './db.ts';
import { uploadPresentation,downloadApprovedSource } from './storage.ts';
import { createJobService } from './job-service.ts';
import { runJsonProcess } from './process.ts';

export type { JobRow } from './job-service.ts';
const service = createJobService(workerPool, {
  async generate(input, output, signal) {
    if(input.content){
      if(!input.previewSource)throw new Error('PRODUCTION_SNAPSHOT_MISMATCH');
      const bytes=await downloadApprovedSource(input.previewSource.key,signal);
      if(createHash('sha256').update(bytes).digest('hex')!==input.previewSource.sha256)throw new Error('PRODUCTION_SNAPSHOT_MISMATCH');
      await writeFile(output,bytes);return;
    }
    await runJsonProcess(env.PYTHON_BIN, [path.join(env.repoRoot, 'engine', 'generate_static_deck.py'),
      '--title', input.title, '--slide-count', String(input.slideCount),
      '--language-mode', input.languageMode, '--output', output], { signal });
  },
  async validate(output, input, signal) {
    const args:string[]=[];
    if(input.content){
      const source=path.join(path.dirname(output),'approved-content.json');
      await writeFile(source,JSON.stringify(input.content),'utf8');args.push('--content',source);
    }
    const report = await runJsonProcess(env.PYTHON_BIN, [path.join(env.repoRoot, 'engine', 'validate_production.py'),
      '--output', output, '--slide-count', String(input.slideCount),
      '--language-mode', input.languageMode,...args], { signal });
    if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('OUTPUT_VALIDATION_FAILED');
    return report as Record<string, unknown>;
  },
  upload(job, filename, bytes, signal) {
    return uploadPresentation(null, job.owner_id, job.project_id, filename, bytes, signal);
  },
});
export const { claimNextAvailableJob, executeClaimedJob } = service;
