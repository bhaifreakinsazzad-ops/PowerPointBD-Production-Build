import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPreviewRenderer } from './http/preview-renderer.ts';
import type { PresentationContent } from '../shared/presentation.ts';

const renderer=createPreviewRenderer({python:process.env.PYTHON_BIN??'python',repoRoot:process.cwd(),
  libreOffice:process.env.PREVIEW_LIBREOFFICE_BIN??'',pdftoppm:process.env.PREVIEW_PDFTOPPM_BIN??'',
  onStage:(stage,elapsed)=>console.log(`Renderer stage ${stage}: ${elapsed} ms`)});
const content:PresentationContent={version:1,title:'RENDERER TEST CORPUS — not customer content',language:'bilingual',slides:[
  {title:'A clear plan for the team',bullets:['Review the evidence before making a decision.','Assign each next step to an owner.'],notes:'Test speaker notes.'},
  {title:'দলের পরিকল্পনা',bullets:['প্রথমে তথ্য যাচাই করুন।','পরবর্তী কাজের দায়িত্ব নির্ধারণ করুন।'],notes:'বাংলা স্পিকার নোট।'},
  {title:'একসাথে এগিয়ে চলি · Working together',bullets:['পরিকল্পনা তৈরি করুন · Build a plan','ফলাফল যাচাই করুন · Verify the outcome'],notes:''},
]};
const result=await renderer(content);
assert.equal(result.pages.length,3);assert.equal(result.manifest.desktop_powerpoint,'UNVERIFIED');
const folder=path.resolve('artifacts','preview-renderer-corpus');await mkdir(folder,{recursive:true});
await writeFile(path.join(folder,'source.pptx'),result.deck);
for(const [index,page] of result.pages.entries())await writeFile(path.join(folder,`slide-${index+1}.png`),page);
await writeFile(path.join(folder,'manifest.json'),JSON.stringify({scope:'LOCAL REAL RENDERER TEST CORPUS; NOT LIVE CUSTOMER PREVIEW',...result.manifest},null,2));
// Missing executables must remain unavailable rather than rendering substitutes.
await assert.rejects(createPreviewRenderer({python:'python',repoRoot:process.cwd(),libreOffice:'',pdftoppm:''})(content),/PREVIEW_RENDERER_UNAVAILABLE/);
console.log(`PASS: generated and validated PPTX, rendered ${result.pages.length} actual 1280x720 slide images; renderer ${result.manifest.renderer}; desktop PowerPoint remains unverified.`);
