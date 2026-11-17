import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,access,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
if(!process.env.npm_execpath)throw new Error('Run npm run test:release.');
const root=await mkdtemp(path.join(tmpdir(),'powerpointbd-release-test-'));
const directory=path.join(root,'runtime');let api,worker;
const run=async(command,args,cwd,env=process.env)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`Runtime install failed (${code}).`)));
});
function start(target,env){
  const child=spawn(process.execPath,['scripts/run-production.mjs',target],{cwd:directory,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.log='';child.on('error',error=>{child.log+='SPAWN_FAILED '+error.code;});
  child.stdout.on('data',data=>{child.log+=data.toString();});child.stderr.on('data',data=>{child.log+=data.toString();});return child;
}
async function stop(child){if(!child||child.exitCode!==null)return;const closed=new Promise(resolve=>child.once('close',resolve));child.kill('SIGTERM');await closed;}
try{
  await cp('dist/release',directory,{recursive:true});
  const manifest=JSON.parse(await readFile(path.join(directory,'release-manifest.json'),'utf8'));
  assert.equal(manifest.release_accepted,false);
  for(const [file,expected] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(path.join(directory,file))).digest('hex'),expected,file);
  await run(process.execPath,[process.env.npm_execpath,'ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],directory);
  for(const tool of ['tsx','typescript','dotenv'])await assert.rejects(access(path.join(directory,'node_modules',tool)));
  // A decoy development file must neither be read nor served by production.
  await writeFile(path.join(directory,'.env.local'),'DECOY_RELEASE_SECRET=not-a-real-secret\n');
  const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const publicKey='sb_publishable_release_fixture_'+randomUUID();
  const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,
    NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_ANON_KEY:publicKey,
    DATABASE_URL:'postgres://fixture@127.0.0.1:1/unused',WEBHOOK_DATABASE_URL:'postgres://fixture@127.0.0.1:1/unused',WORKER_DATABASE_URL:'postgres://fixture@127.0.0.1:1/unused'};
  api=start('api',env);const base=`http://127.0.0.1:${port}`;let ready=false;
  for(let i=0;i<100;i++){
    if(api.exitCode!==null)throw new Error('Compiled API exited: '+api.log);
    try{const response=await fetch(base+'/api/health');if(response.status===200){ready=true;break;}}catch{}
    await delay(100);
  }
  assert.ok(ready,'Compiled API did not start: '+api.log);
  const html=await(await fetch(base+'/')).text();assert.ok(html.includes('Turn your idea into a clear story.'));assert.ok(!html.includes('Interactive prototype'));
  const config=await(await fetch(base+'/api/public-config')).json();assert.equal(config.data.supabaseAnonKey,publicKey);
  const capabilities=await(await fetch(base+'/api/commerce/capabilities')).json();assert.equal(capabilities.data.sandbox_available,false);assert.equal(capabilities.data.live_checkout_available,false);
  assert.equal((await fetch(base+'/api/projects')).status,401);
  assert.equal((await fetch(base+'/api/webhooks/mock_sandbox',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,404);
  for(const route of ['/live-demo.html','/prototype.html','/prototype.js','/evidence.js','/.env.local','/server/http/env.js','/engine/generate_static_deck.py']){
    const response=await fetch(base+route);assert.equal(response.status,404,route);assert.ok(!(await response.text()).includes('DECOY_RELEASE_SECRET'));
  }
  const appManifest=await(await fetch(base+'/manifest.webmanifest')).json();assert.equal(appManifest.name,'PowerPointBD');assert.equal(appManifest.icons.length,2);
  for(const size of [192,512]){const bytes=Buffer.from(await(await fetch(base+`/icons/icon-${size}.png`)).arrayBuffer());assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
  const sw=await fetch(base+'/sw.js');assert.equal(sw.headers.get('cache-control'),'no-cache');assert.equal(sw.headers.get('service-worker-allowed'),'/');
  worker=start('worker',env);
  for(let i=0;i<100&&!worker.log.includes('background worker starting');i++){if(worker.exitCode!==null)break;await delay(100);}
  assert.ok(worker.log.includes('background worker starting'),'Compiled worker entrypoint did not start: '+worker.log);
  assert.ok(!worker.log.includes('ERR_MODULE_NOT_FOUND'));
  console.log('PASS: isolated npm ci --omit=dev, compiled API/worker entrypoints, production guards, studio root, icons and private-file/demo exclusion. No external database or provider contacted.');
}finally{
  await stop(worker);await stop(api);
  if(path.dirname(root)!==path.resolve(tmpdir())||!path.basename(root).startsWith('powerpointbd-release-test-'))throw new Error('Unexpected release test directory.');
  await rm(root,{recursive:true,force:true});
}
