import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const html=await readFile('studio.html','utf8');
await writeFile('dist/qa-studio.html',html.replace('./studio.js','./qa-studio.js'));
await build({entryPoints:{'qa-studio':'tests/studio-browser-harness.ts'},outdir:'dist',bundle:true,
  splitting:true,format:'esm',platform:'browser',target:'es2022',minify:true,chunkNames:'assets/qa-[name]-[hash]'});
