import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { validatePresentation, type PresentationContent } from '../../shared/presentation.ts';
import { runBoundedProcess, runJsonProcess,ProcessFailure } from './process.ts';

export interface PreviewRender {
  deck: Buffer; pages: Buffer[];
  manifest: { renderer: string; template: string; pptx_sha256: string; page_sha256: string[];
    slide_count: number; desktop_powerpoint: 'UNVERIFIED' };
}
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
// Office conversion has taken over 60s on the first cold run on Windows. The
// worker renews its lease while rendering, so a longer bounded stage timeout
// avoids wasting a quota-charged attempt without allowing unbounded processes.
const RENDER_STAGE_TIMEOUT_MS = 180_000;
/** Render the generated PPTX itself. Never synthesize substitute slide imagery. */
export function createPreviewRenderer(config: { python: string; repoRoot: string; libreOffice: string; pdftoppm: string;
  onStage?:(stage:string,elapsedMs:number)=>void }) {
  return async (source: PresentationContent, signal?: AbortSignal): Promise<PreviewRender> => {
    const content = validatePresentation(source);
    if (!config.libreOffice || !config.pdftoppm) throw new Error('PREVIEW_RENDERER_UNAVAILABLE');
    const directory = await mkdtemp(path.join(tmpdir(),'powerpointbd-preview-'));
    const measured=async<T>(stage:string,work:()=>Promise<T>):Promise<T>=>{
      const began=Date.now();
      try{return await work();}
      catch(error){if(error instanceof ProcessFailure&&error.code==='PROCESS_TIMEOUT')throw new Error(`PREVIEW_${stage.toUpperCase()}_TIMEOUT`);throw error;}
      finally{config.onStage?.(stage,Date.now()-began);}
    };
    try {
      const contentFile = path.join(directory,'content.json'), deckFile = path.join(directory,'deck.pptx');
      await writeFile(contentFile,JSON.stringify(content),'utf8');
      await measured('generation',()=>runJsonProcess(config.python,[path.join(config.repoRoot,'engine','generate_static_deck.py'),
        '--content',contentFile,'--output',deckFile],{signal}));
      const validation = await measured('validation',()=>runJsonProcess(config.python,[path.join(config.repoRoot,'engine','validate_production.py'),
        '--content',contentFile,'--output',deckFile,'--slide-count',String(content.slides.length),
        '--language-mode',content.language],{signal}));
      if (!validation || typeof validation !== 'object' || !('passed' in validation) || validation.passed !== true) throw new Error('PREVIEW_PACKAGE_INVALID');
      const profile = path.join(directory,'profile'); await mkdir(profile);
      let version:string;
      try{
        // Cold Windows startup exceeded 15s in the real integration check.
        // Isolate even the version probe from a user's ordinary Office profile.
        version=(await measured('startup',()=>runBoundedProcess(config.libreOffice,[`-env:UserInstallation=${pathToFileURL(profile).href}`,
          '--headless','--nologo','--norestore','--version'],{signal,timeoutMs:60000}))).trim();
      }catch(error){if(error instanceof ProcessFailure&&error.code==='PROCESS_TIMEOUT')throw new Error('PREVIEW_RENDERER_STARTUP_TIMEOUT');throw error;}
      if (!/^LibreOffice \d+\.\d+/.test(version)) throw new Error('PREVIEW_RENDERER_UNAVAILABLE');
      await measured('conversion',()=>runBoundedProcess(config.libreOffice,[`-env:UserInstallation=${pathToFileURL(profile).href}`,
        '--headless','--nologo','--nodefault','--norestore','--convert-to','pdf:impress_pdf_Export',
        '--outdir',directory,deckFile],{signal,timeoutMs:RENDER_STAGE_TIMEOUT_MS}));
      const pdf = path.join(directory,'deck.pdf');
      if ((await stat(pdf)).size > 64 * 1024 * 1024) throw new Error('PREVIEW_RESOURCE_LIMIT');
      // 96dpi gives a consistent 1280x720 image, with bounded resources even for
      // 100 slides. Office conversion may differ from desktop PowerPoint.
      await measured('rasterization',()=>runBoundedProcess(config.pdftoppm,['-png','-r','96','-scale-to-x','1280','-scale-to-y','720',
        pdf,path.join(directory,'slide')],{signal,timeoutMs:RENDER_STAGE_TIMEOUT_MS}));
      const files = (await readdir(directory)).filter((file)=>/^slide-\d+\.png$/.test(file))
        .sort((a,b)=>Number(a.match(/\d+/)![0])-Number(b.match(/\d+/)![0]));
      if (files.length !== content.slides.length) throw new Error('PREVIEW_PAGE_COUNT_MISMATCH');
      let totalBytes = 0;
      const pages: Buffer[] = [];
      for (const [index,file] of files.entries()) {
        if (Number(file.match(/\d+/)![0]) !== index+1) throw new Error('PREVIEW_PAGE_COUNT_MISMATCH');
        const size = (await stat(path.join(directory,file))).size; totalBytes += size;
        if (size > 8*1024*1024 || totalBytes > 64*1024*1024) throw new Error('PREVIEW_RESOURCE_LIMIT');
        const bytes = await readFile(path.join(directory,file));
        if (bytes.length < 24 || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a'
            || bytes.readUInt32BE(16) !== 1280 || bytes.readUInt32BE(20) !== 720) throw new Error('PREVIEW_IMAGE_INVALID');
        pages.push(bytes);
      }
      const deck = await readFile(deckFile);
      return {deck,pages,manifest:{renderer:version.slice(0,160),template:'corporate_slate-v1',
        pptx_sha256:sha(deck),page_sha256:pages.map(sha),slide_count:pages.length,desktop_powerpoint:'UNVERIFIED'}};
    } finally {
      // mkdtemp's exact private directory, never a path from client JSON.
      await rm(directory,{recursive:true,force:true});
    }
  };
}
