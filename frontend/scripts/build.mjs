import {mkdir,copyFile,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const output=path.resolve('dist'),development=process.argv.includes('--development');
if(path.basename(process.cwd())!=='frontend'||path.dirname(output)!==process.cwd())throw new Error('Unexpected build directory');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
const studioHtml=await readFile('studio.html','utf8');
const homeHtml=await readFile('home.html','utf8');
await writeFile('dist/index.html',homeHtml);
await writeFile('dist/home.html',homeHtml);
await writeFile('dist/studio.html',studioHtml);
await copyFile('src/studio/studio.css','dist/studio.css');
await copyFile('public/studio.webmanifest','dist/manifest.webmanifest');
await mkdir('dist/icons',{recursive:true});
for(const name of ['icon-192.png','icon-512.png'])await copyFile('public/icons/'+name,'dist/icons/'+name);
for(const name of ['payment-qr-card.png','payment-qr-card.webp','bangla-qr.png','bangla-qr.webp']){
  try{await copyFile('public/'+name,'dist/'+name);}catch{}
}
await build({entryPoints:{studio:'src/studio/main.ts'},outdir:'dist',bundle:true,splitting:true,
  format:'esm',platform:'browser',target:'es2022',minify:true,chunkNames:'assets/[name]-[hash]',logLevel:'info'});
async function files(directory,prefix=''){
  const entries=await readdir(directory,{withFileTypes:true});const result=[];
  for(const entry of entries){const relative=prefix+entry.name;
    if(entry.isDirectory())result.push(...await files(path.join(directory,entry.name),relative+'/'));else result.push(relative);
  }return result.sort();
}
const shell=await files(output),hash=createHash('sha256');
for(const file of shell){hash.update(file);hash.update(await readFile(path.join(output,file)));}
let worker=await readFile('src/studio/service-worker.template.js','utf8');
worker=worker.replace('__CACHE_VERSION__',hash.digest('hex').slice(0,16)).replace('__PRECACHE_FILES__',JSON.stringify(['./',...shell.map(file=>'./'+file)]));
await writeFile('dist/sw.js',worker);
if(development){
  await copyFile('index.html','dist/prototype.html');
  for(const name of ['styles.css','evidence.js','live-demo.html'])await copyFile('public/'+name,'dist/'+name);
  for(const name of ['prototype.js','accessibility.js'])await copyFile('src/'+name,'dist/'+name);
  console.log('Development extras included. Do not deploy this development build.');
}
console.log('Built the PowerPointBD studio as the public entrypoint; release output excludes development demos by default.');
