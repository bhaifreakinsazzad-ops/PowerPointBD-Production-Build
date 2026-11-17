import { workerPool } from './db.ts';
import { env } from './env.ts';
import { createPreviewService } from './preview-service.ts';
import { createPreviewRenderer } from './preview-renderer.ts';
import { uploadPreviewFile } from './storage.ts';

const service=createPreviewService(workerPool,{
  render:createPreviewRenderer({python:env.PYTHON_BIN,repoRoot:env.repoRoot,
    libreOffice:env.PREVIEW_LIBREOFFICE_BIN,pdftoppm:env.PREVIEW_PDFTOPPM_BIN}),
  upload:(job,file,signal)=>uploadPreviewFile(job.owner_id,job.project_id,file.name,file.bytes,file.mime,signal),
});
export const claimPreview=service.claim;
export const executePreview=service.execute;
