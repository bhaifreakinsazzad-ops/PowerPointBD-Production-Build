import {readFile,writeFile,mkdir,copyFile,cp,rm,lstat,readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'dist','release');
const require=createRequire(import.meta.url);
if(path.resolve(process.cwd()).toLowerCase()!==root.toLowerCase())throw new Error('Run the release build from the repository root.');
for(const item of [path.dirname(output),output]){
  try{if((await lstat(item)).isSymbolicLink())throw new Error('Refusing a release output symlink.');}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
try{await lstat(output);await readFile(path.join(output,'.powerpointbd-release-output'));}
catch(error){if(error.code!=='ENOENT')throw error;if(await lstat(output).catch(()=>null))throw new Error('Existing release directory has no build marker; refusing cleanup.');}
if(path.dirname(output)!==path.join(root,'dist')||path.basename(output)!=='release')throw new Error('Unexpected release directory.');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await writeFile(path.join(output,'.powerpointbd-release-output'),'Generated PowerPointBD build output.\n');
async function run(command,args,cwd=root){
  await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`Release build command failed (${code}).`)));});
}
await run(process.execPath,[require.resolve('typescript/lib/tsc.js'),'-p','tsconfig.release.json']);
await run(process.execPath,['scripts/build.mjs'],path.join(root,'frontend'));
await cp(path.join(root,'frontend','dist'),path.join(output,'public'),{recursive:true});
await mkdir(path.join(output,'engine'),{recursive:true});
for(const name of ['generate_static_deck.py','validate_production.py','phase0.py','content_contract.py','requirements.txt'])await copyFile(path.join(root,'engine',name),path.join(output,'engine',name));
await mkdir(path.join(output,'scripts'),{recursive:true});
await copyFile(path.join(root,'scripts','run-production.mjs'),path.join(output,'scripts','run-production.mjs'));
const source=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const pkg={name:source.name,version:source.version,private:true,type:'module',engines:{node:'22.x'},
  scripts:{start:'node scripts/run-production.mjs api',worker:'node scripts/run-production.mjs worker'},dependencies:source.dependencies};
const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
lock.packages['']={name:pkg.name,version:pkg.version,dependencies:pkg.dependencies,engines:pkg.engines};
for(const entry of Object.values(lock.packages)){
  if(entry.link)throw new Error('Runtime lockfile contains a local linked package.');
  if(entry.resolved){const url=new URL(entry.resolved);if(url.username||url.password)throw new Error('Refusing credentials in a runtime dependency URL.');}
}
await writeFile(path.join(output,'package.json'),JSON.stringify(pkg,null,2)+'\n');
await writeFile(path.join(output,'package-lock.json'),JSON.stringify(lock,null,2)+'\n');
await writeFile(path.join(output,'README.md'),'# PowerPointBD runtime package\n\nLocal build artifact, not a deployment or release acceptance.\n\nUse Node.js 22, `npm ci --omit=dev`, then provide environment variables securely. `npm start` starts the studio/API on the configured listener; `npm run worker` starts the separate worker. Both entrypoints enforce production mode. Install `engine/requirements.txt` in an isolated Python environment and configure the rendering executables.\n\nProduction commerce is unavailable until a real provider is integrated and verified. See the repository release runbook before applying migrations, exposing this package, or activating payments. No credentials or development dotenv file are included.\n');
async function list(directory,prefix=''){
  const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=prefix+entry.name;if(entry.isDirectory())result.push(...await list(path.join(directory,entry.name),relative+'/'));else result.push(relative);
  }return result.sort();
}
const files=await list(output),hashes={};
for(const file of files){
  if(/(?:^|\/)(?:test[^/]*|demo[^/]*|qa-[^/]*|\.env(?:\.[^/]*)?|node_modules)(?:\/|$)/i.test(file)||/\.test\./i.test(file)||file.endsWith('.ts'))throw new Error(`Unexpected development file in release: ${file}`);
  hashes[file]=createHash('sha256').update(await readFile(path.join(output,file))).digest('hex');
}
for(const forbidden of ['live-demo.html','prototype.html','prototype.js','evidence.js'])if(files.includes('public/'+forbidden))throw new Error('Development page leaked into release.');
await writeFile(path.join(output,'release-manifest.json'),JSON.stringify({format:1,release_accepted:false,files:hashes},null,2)+'\n');
console.log(`Built ${files.length} runtime files in dist/release; no deployment or acceptance is implied.`);
