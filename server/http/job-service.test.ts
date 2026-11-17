import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import express from 'express';
import { createJobService, LeaseLost, type JobDependencies, type JobRow } from './job-service.ts';
import { createProduceRouter } from './routes/produce.ts';
import { createSandboxPaymentService } from './payment-service.ts';
import { createWebhooksRouter } from './routes/webhooks.ts';
import { createCheckoutRouter } from './routes/checkout.ts';
import { createProjectsRouter } from './routes/projects.ts';
import { createContentRouter } from './routes/content.ts';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { createPreviewService } from './preview-service.ts';
import { createPreviewsRouter } from './routes/previews.ts';
import { createPreviewRenderer } from './preview-renderer.ts';
import { commercePolicy } from './commerce-policy.ts';
import { paidProductionInput } from './production-entitlement.ts';
import { runJsonProcess } from './process.ts';
import path from 'node:path';

const url = new URL(process.env.JOB_TEST_DATABASE_URL ?? 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.username !== 'codex_test' || process.env.POWERPOINTBD_DISPOSABLE_TEST !== '1') {
  throw new Error('Use npm run test:jobs:local to create the disposable database.');
}
const db = new Pool({ connectionString: url.toString() });
const workerUrl = new URL(url); workerUrl.username = 'ai_presentation_worker';
const workerDb = new Pool({ connectionString: workerUrl.toString() });
const webhookUrl = new URL(url); webhookUrl.username = 'ai_presentation_webhook';
const webhookDb = new Pool({ connectionString: webhookUrl.toString() });
let uploads = 0;
const dependencies: JobDependencies = {
  async generate(_input, output) { await writeFile(output, 'local-test-deck'); },
  async validate() { return { passed: true, scope: 'test-double' }; },
  async upload(job, filename) { uploads++; return { storageKey: `${job.owner_id}/${job.project_id}/${filename}` }; },
};

before(async () => {
  await db.query(`CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE ROLE ai_presentation_worker LOGIN BYPASSRLS;
    CREATE ROLE ai_presentation_webhook LOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, instance_id uuid, aud text, role text, email text,
      encrypted_password text, email_confirmed_at timestamptz, created_at timestamptz,
      updated_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;`);
  await db.query(await readFile('db/migrations/0002_supabase_ai_presentation_schema.sql', 'utf8'));
  await db.query(await readFile('db/migrations/0003_supabase_admin_rls_fixes_and_grants.sql', 'utf8'));
  const productionMigration = await readFile('db/migrations/0004_supabase_storage_and_production_grants.sql', 'utf8');
  // Storage itself requires Supabase. Apply the exact application's job/asset grants and policies.
  await db.query(productionMigration.slice(productionMigration.indexOf('GRANT INSERT, UPDATE ON ai_presentation.jobs')));
  await db.query(await readFile('db/migrations/0005_supabase_checkout_webhook_and_roles.sql', 'utf8'));
  await db.query(`GRANT USAGE ON SCHEMA ai_presentation TO ai_presentation_worker, ai_presentation_webhook;
    GRANT SELECT, UPDATE ON ai_presentation.jobs TO ai_presentation_worker;
    GRANT SELECT, INSERT ON ai_presentation.generated_assets TO ai_presentation_worker;
    GRANT SELECT ON ai_presentation.projects, ai_presentation.design_specs, ai_presentation.entitlements TO ai_presentation_worker;
    GRANT SELECT, UPDATE ON ai_presentation.payments TO ai_presentation_webhook;
    GRANT SELECT, INSERT, DELETE ON ai_presentation.payment_webhook_events, ai_presentation.entitlements TO ai_presentation_webhook;
    GRANT SELECT ON ai_presentation.quotes, ai_presentation.design_specs TO ai_presentation_webhook;
    GRANT SELECT, UPDATE ON ai_presentation.projects TO ai_presentation_webhook;
    GRANT INSERT ON ai_presentation.audit_logs TO ai_presentation_webhook;`);
  await db.query(await readFile('db/migrations/0007_payment_snapshot_integrity.sql', 'utf8'));
  await db.query(await readFile('db/migrations/0008_versioned_content_drafts.sql', 'utf8'));
  await db.query(await readFile('db/migrations/0009_durable_static_previews.sql', 'utf8'));
  await db.query(await readFile('db/migrations/0010_explicit_preview_approval.sql', 'utf8'));
  // Minimal Storage object ledger for executing the real SQL policy locally;
  // bytes/signed URL behavior still require separate Supabase verification.
  await db.query(`CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
    CREATE POLICY unrelated_broad_policy ON storage.objects FOR ALL TO authenticated,anon USING(TRUE) WITH CHECK(TRUE);`);
  await db.query(await readFile('db/migrations/0011_private_immutable_presentation_objects.sql','utf8'));
});
beforeEach(async () => { uploads = 0; await db.query('TRUNCATE ai_presentation.jobs CASCADE'); });
after(async () => { await webhookDb.end(); await workerDb.end(); await db.end(); });

test('production refuses mock checkout, webhook processing and stored mock entitlements before SQL work',async()=>{
  let touched=false;
  const context=async <T>(_id:string,_fn:(client:import('pg').PoolClient)=>Promise<T>):Promise<T>=>{touched=true;throw new Error('must not query');};
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:randomUUID(),email:null,accessToken:'fixture'};next();});
  app.use(createCheckoutRouter(context,()=>commercePolicy('production')));
  app.use(createWebhooksRouter(async()=>{touched=true;throw new Error('must not process');},()=>commercePolicy('production')));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}`;
  const mode=env.NODE_ENV;
  try{
    assert.equal((await fetch(base+'/checkout/session',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,503);
    assert.equal((await fetch(base+'/webhooks/mock_sandbox',{method:'POST',headers:{'content-type':'application/json','x-mock-signature':'fixture'},body:'{}'})).status,404);
    env.NODE_ENV='production';
    assert.equal(await paidProductionInput({query:async()=>{touched=true;throw new Error('must not query');}} as Pick<Pool,'query'>,{projectId:randomUUID(),ownerId:randomUUID(),specId:randomUUID(),entitlementId:randomUUID()}),null);
    assert.equal(touched,false);
  }finally{env.NODE_ENV=mode;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('customer order status isolates accounts and derives production access from the verified paid chain',async()=>{
  const f=await fixture();const app=express();app.use((req,_res,next)=>{req.user={id:req.header('x-test-owner')??f.owner,email:null,accessToken:'fixture'};next();});
  app.use(createCheckoutRouter(asUser));const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');const route=`http://127.0.0.1:${address.port}/projects/${f.project.id}/order`;
  try{
    const read=async()=>((await (await fetch(route)).json()) as {data:{can_produce:boolean;download_available:boolean;commerce:{live_checkout_available:boolean};production:{status:string}|null}}).data;
    assert.equal((await read()).can_produce,true);assert.equal((await read()).commerce.live_checkout_available,false);
    assert.equal((await fetch(route,{headers:{'x-test-owner':randomUUID()}})).status,404);
    await enqueue(f);assert.equal((await read()).can_produce,false);
    const service=createJobService(workerDb,dependencies);await service.executeClaimedJob(required(await service.claimNextAvailableJob()));
    assert.equal((await read()).download_available,true);assert.equal((await read()).production?.status,'completed');
    await db.query("UPDATE ai_presentation.payments SET status='refunded' WHERE id=$1",[f.payment.id]);
    assert.equal((await read()).download_available,false);assert.equal((await read()).can_produce,false);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('public configuration rejects secret keys and malformed request bodies fail without auth or database work', async () => {
  const original = env.SUPABASE_ANON_KEY;
  const server = createApp().listen(0,'127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening',resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health=await fetch(base+'/health',{headers:{origin:'http://localhost:3000'}});
    assert.equal(health.headers.get('access-control-allow-origin'),'http://localhost:3000');
    assert.equal(health.headers.get('cache-control'),'no-store');assert.equal(health.headers.get('x-content-type-options'),'nosniff');
    assert.equal(health.headers.get('x-powered-by'),null);
    const denied=await fetch(base+'/health',{headers:{origin:'https://untrusted.test.invalid'}});
    assert.equal(denied.headers.get('access-control-allow-origin'),null);
    assert.equal((await fetch(base+'/health',{method:'OPTIONS',headers:{origin:'https://untrusted.test.invalid'}})).status,403);
    for (const key of ['sb_secret_test',`header.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`]) {
      env.SUPABASE_ANON_KEY = key;
      const response = await fetch(base+'/public-config'); assert.equal(response.status,503);
      assert.equal((await response.text()).includes(key),false);
    }
    env.SUPABASE_ANON_KEY = 'sb_publishable_test';
    const config = await fetch(base+'/public-config'); assert.equal(config.status,200);
    assert.deepEqual(Object.keys(((await config.json()) as {data:object}).data).sort(),['supabaseAnonKey','supabaseUrl']);
    assert.equal((await fetch(base+'/projects')).status,401);
    const invalid = await fetch(base+'/projects', {method:'POST',headers:{'content-type':'application/json'},body:'{"private brief":INVALID'});
    assert.equal(invalid.status,400); assert.equal((await invalid.text()).includes('private brief'),false);
    const oversized = await fetch(base+'/projects', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(270000)})});
    assert.equal(oversized.status,413);
  } finally {
    env.SUPABASE_ANON_KEY = original;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('versioned content enforces RLS, concurrent edits, retry semantics and immutable history', async () => {
  const f = await fixture();
  // A fresh draft project, not the paid/locked production fixture above.
  const project = (await db.query("INSERT INTO ai_presentation.projects(owner_id,title,slide_count,language_mode) VALUES($1,'Draft',1,'en') RETURNING id", [f.owner])).rows[0];
  const context = async <T>(id: string, fn: (client: import('pg').PoolClient) => Promise<T>) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id })]);
      const result = await fn(client); await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.header('x-test-owner') ?? f.owner, email: null, accessToken: 'fixture' }; next(); });
  app.use(createContentRouter(context)); app.use(createProjectsRouter(context));
  const server = app.listen(0,'127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening',resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/projects/${project.id}/content`;
  const content = { version: 1, title: 'Reviewed draft', language: 'en', slides: [{ title: 'A safe title', bullets: ['Customer text'], notes: 'Speaker notes' }] };
  const save = (expected_version: number, document = content, owner = f.owner) => fetch(base, { method: 'PUT', headers: { 'content-type':'application/json','x-test-owner': owner }, body: JSON.stringify({ expected_version, content: document }) });
  try {
    assert.equal(((await (await fetch(base)).json()) as { data: { draft: unknown } }).data.draft, null);
    assert.equal((await save(0)).status,201);
    assert.equal((await save(0)).status,200);
    const motion = await fetch(base.replace('/content','/motion'), {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({motion_tier:'static',transition_id:null,intensity:null})});
    assert.equal(motion.status,409);
    assert.equal(((await motion.json()) as {error:{code:string}}).error.code,'DESIGN_APPROVAL_REQUIRED');
    const outsider = randomUUID();
    assert.equal((await fetch(base,{ headers:{'x-test-owner':outsider} })).status,404);
    assert.equal((await save(1,content,outsider)).status,404);
    // This assertion queries as the real authenticated role, not an auth mock.
    assert.equal(await context(outsider, async (client) => (await client.query('SELECT * FROM ai_presentation.content_drafts WHERE project_id=$1',[project.id])).rowCount),0);
    const a = { ...content, title:'Editor A' }, b = { ...content, title:'Editor B' };
    const race = await Promise.all([save(1,a),save(1,b)]);
    assert.deepEqual(race.map((r) => r.status).sort(),[201,409]);
    assert.equal((await save(0,b)).status,409);
    assert.equal((await save(2,{ ...content, slides:[] })).status,400);
    await assert.rejects(context(f.owner, async (client) => { await client.query("UPDATE ai_presentation.content_drafts SET content='{}' WHERE project_id=$1",[project.id]); }),/permission denied/);
    await assert.rejects(db.query("UPDATE ai_presentation.content_drafts SET content='{}' WHERE project_id=$1",[project.id]),/CONTENT_DRAFT_IMMUTABLE/);
    await assert.rejects(context(f.owner, async (client) => { await client.query('INSERT INTO ai_presentation.content_drafts VALUES($1,100,$2,now())',[project.id,JSON.stringify(content)]); }),/CONTENT_VERSION_CONFLICT/);
    await db.query("UPDATE ai_presentation.projects SET state='preview_queued' WHERE id=$1",[project.id]);
    assert.equal((await save(2,content)).status,409);
    const restored = ((await (await fetch(base)).json()) as { data: { draft: { version: number; content: { title: string } } } }).data.draft;
    assert.equal(restored.version,2); assert.ok(['Editor A','Editor B'].includes(restored.content.title));
    assert.equal((await db.query('SELECT * FROM ai_presentation.content_drafts WHERE project_id=$1',[project.id])).rowCount,2);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

async function fixture(owner: string = randomUUID(), expires = new Date(Date.now() + 86_400_000).toISOString(), paid = true) {
  await db.query('INSERT INTO auth.users (id,email) VALUES ($1,$2) ON CONFLICT DO NOTHING', [owner, `${owner}@test.invalid`]);
  const project = (await db.query(`INSERT INTO ai_presentation.projects
    (owner_id,title,slide_count,language_mode,motion_tier_requested,state)
    VALUES ($1,'Local worker test',3,'en','static',$2) RETURNING *`, [owner, paid ? 'paid' : 'quoted'])).rows[0];
  const spec = (await db.query(`INSERT INTO ai_presentation.design_specs (project_id,is_locked,spec_json)
    VALUES ($1,TRUE,'{"motion_tier":"static","intensity":null,"transition_id":null,"animation_policy":"static-v1","slide_count":3,"title":"Local worker test","language_mode":"en"}') RETURNING *`, [project.id])).rows[0];
  const quote = (await db.query(`INSERT INTO ai_presentation.quotes
    (project_id,owner_id,design_spec_id,pricing_config_version,tier,slide_count,base_rate_bdt,motion_rate_bdt,
     quote_amount,quote_amount_paisa,quote_breakdown,expires_at,status)
    VALUES ($1,$2,$3,1,'static',3,25,0,75,7500,'{}',$4,$5) RETURNING *`, [project.id, owner, spec.id, expires, paid ? 'paid' : 'active'])).rows[0];
  const payment = (await db.query(`INSERT INTO ai_presentation.payments
    (project_id,owner_id,quote_id,provider_session_id,idempotency_key,tier,quote_amount,quote_amount_paisa,quote_breakdown,status,provider,webhook_signature_verified)
    VALUES ($1,$2,$3,$4,$4,'static',75,7500,'{}',$5,'mock_sandbox',$6) RETURNING *`, [project.id, owner, quote.id, randomUUID(), paid ? 'verified' : 'pending', paid])).rows[0];
  const entitlement = paid ? (await db.query(`INSERT INTO ai_presentation.entitlements
    (project_id,owner_id,payment_id,design_spec_id,motion_tier) VALUES ($1,$2,$3,$4,'static') RETURNING *`,
    [project.id, owner, payment.id, spec.id])).rows[0] : undefined;
  return { project, spec, entitlement, owner, payment, quote };
}
async function enqueue(f: Awaited<ReturnType<typeof fixture>>) {
  return (await db.query(`INSERT INTO ai_presentation.jobs (project_id,owner_id,design_spec_id,entitlement_id,idempotency_key)
    VALUES ($1,$2,$3,$4,$5) RETURNING *`, [f.project.id, f.owner, f.spec.id, f.entitlement.id, randomUUID()])).rows[0] as JobRow;
}
async function getJob(id: string) { return (await db.query('SELECT * FROM ai_presentation.jobs WHERE id=$1', [id])).rows[0]; }

async function asUser<T>(id:string,fn:(client:import('pg').PoolClient)=>Promise<T>):Promise<T>{
  const client=await db.connect();
  try{await client.query('BEGIN');await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id})]);
    const result=await fn(client);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
const previewContent={version:1 as const,title:'Preview fixture',language:'en' as const,slides:[{title:'A real content contract',bullets:['Test-controlled text'],notes:''}]};
async function draftProject(owner?:string){
  const f=await fixture(owner);
  const project=(await db.query("INSERT INTO ai_presentation.projects(owner_id,title,slide_count,language_mode) VALUES($1,'Preview fixture',1,'en') RETURNING *",[f.owner])).rows[0];
  await db.query('INSERT INTO ai_presentation.content_drafts(project_id,version,content) VALUES($1,1,$2)',[project.id,JSON.stringify(previewContent)]);
  return {owner:f.owner,project};
}
async function previewJob(f:Awaited<ReturnType<typeof draftProject>>,max=1){
  const job=(await db.query("INSERT INTO ai_presentation.jobs(project_id,owner_id,job_type,idempotency_key,max_attempts) VALUES($1,$2,'static_preview',$3,$4) RETURNING *",[f.project.id,f.owner,randomUUID(),max])).rows[0];
  await db.query('INSERT INTO ai_presentation.preview_requests(job_id,project_id,owner_id,content_version) VALUES($1,$2,$3,1)',[job.id,f.project.id,f.owner]);
  await db.query("UPDATE ai_presentation.projects SET state='preview_queued' WHERE id=$1",[f.project.id]);return job;
}

if(process.env.POWERPOINTBD_REAL_RENDERER_TEST==='1')test('real rendered preview -> explicit approval -> sandbox payment -> byte-identical Static delivery',async()=>{
  const f=await draftProject(),storage=new Map<string,Buffer>();
  const app=express();app.use(express.json({verify(req,_res,raw){(req as unknown as {rawBody:Buffer}).rawBody=raw;}}));
  app.use((req,_res,next)=>{req.user={id:req.header('x-test-owner')??f.owner,email:null,accessToken:'local-auth-fixture'};next();});
  app.use(createProjectsRouter(asUser));app.use(createContentRouter(asUser));
  app.use(createPreviewsRouter(asUser,async(_token,key)=>`https://storage.test.invalid/${key}`));
  app.use(createCheckoutRouter(asUser));app.use(createWebhooksRouter(processPayment));
  app.use(createProduceRouter({withUserContext:asUser,async createSignedDownloadUrl(_token,key){return `https://storage.test.invalid/${key}`;}}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}`;
  const projectPath=`/projects/${f.project.id}`;
  const post=async<T=Record<string,unknown>>(route:string,body:object,status:number):Promise<T>=>{const response=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const json=await response.json() as {data:T};assert.equal(response.status,status,JSON.stringify(json));return json.data;};
  try{
    const previewKey=randomUUID();await post(projectPath+'/previews',{content_version:1,idempotency_key:previewKey},202);
    const previews=createPreviewService(workerDb,{render:createPreviewRenderer({python:env.PYTHON_BIN,repoRoot:env.repoRoot,
      libreOffice:process.env.PREVIEW_LIBREOFFICE_BIN??'',pdftoppm:process.env.PREVIEW_PDFTOPPM_BIN??'',
      onStage:(stage,elapsed)=>console.log(`Real renderer stage ${stage}: ${elapsed}ms`)}),
      async upload(job,file){const storageKey=`${job.owner_id}/${job.project_id}/${file.name}`;storage.set(storageKey,file.bytes);return {storageKey};}});
    let previewAttempt=required(await previews.claim());
    for(;;){
      try{await previews.execute(previewAttempt);break;}
      catch(error){
        const failed=await getJob(previewAttempt.id);
        if(failed.status!=='failed'||previewAttempt.attempts>=previewAttempt.max_attempts)throw error;
        // Drive the same durable recovery schedule as the real worker. Do not
        // rerun a fresh job, erase the failure, or bypass the retry ceiling.
        assert.equal((await db.query('SELECT free_preview_projects_used FROM ai_presentation.users WHERE id=$1',[f.owner])).rows[0].free_preview_projects_used,1);
        assert.equal((await db.query('SELECT count(*)::integer n FROM ai_presentation.generated_assets WHERE job_id=$1',[previewAttempt.id])).rows[0].n,0);
        console.log(`Real preview attempt ${previewAttempt.attempts} recorded ${failed.error_code}; awaiting its durable retry.`);
        await delay(Math.max(0,new Date(failed.next_retry_at).getTime()-Date.now())+100);
        const retry=required(await previews.claim());assert.equal(retry.id,previewAttempt.id);assert.equal(retry.attempts,previewAttempt.attempts+1);previewAttempt=retry;
      }
    }
    const result=(await (await fetch(base+projectPath+'/previews')).json()) as {data:{preview:{job_id:string;manifest_sha256:string;render_manifest:{pptx_sha256:string;source_asset_id:string}}}};
    const preview=result.data.preview;
    assert.equal((await fetch(base+projectPath+'/download')).status,409);
    await post(projectPath+'/approve-preview',{preview_job_id:preview.job_id,content_version:1,manifest_sha256:preview.manifest_sha256,confirmed:true},201);
    await post(projectPath+'/motion',{motion_tier:'static',transition_id:null,intensity:null},200);
    await db.query("UPDATE ai_presentation.projects SET title='Mutable metadata',language_mode='bn',slide_count=9 WHERE id=$1",[f.project.id]);
    const quote=await post<{quote:{id:string;quote_amount:number;slide_count:number}}>(projectPath+'/quote',{},201);assert.equal(quote.quote.quote_amount,25);assert.equal(quote.quote.slide_count,1);
    const checkout=await post<{payment:{provider_session_id:string}}>('/checkout/session',{quote_id:quote.quote.id,idempotency_key:randomUUID()},201);
    const raw=Buffer.from(JSON.stringify({event_id:randomUUID(),provider_session_id:checkout.payment.provider_session_id,status:'VALID',amount_bdt:25,currency:'BDT'}));
    const payment=await fetch(base+'/webhooks/mock_sandbox',{method:'POST',headers:{'content-type':'application/json','x-mock-signature':createHmac('sha256',PAYMENT_TEST_SECRET).update(raw).digest('hex')},body:raw});assert.equal(payment.status,200);
    await post(projectPath+'/produce',{idempotency_key:previewKey},409);
    await post(projectPath+'/produce',{idempotency_key:randomUUID()},202);
    const production=createJobService(workerDb,{
      async generate(input,output){assert.deepEqual(input.content,previewContent);assert.equal(input.previewSource?.sha256,preview.render_manifest.pptx_sha256);const source=storage.get(input.previewSource!.key);assert.ok(source);await writeFile(output,source);},
      async validate(output,input,signal){const contentFile=path.join(path.dirname(output),'content.json');await writeFile(contentFile,JSON.stringify(input.content));return await runJsonProcess(env.PYTHON_BIN,[path.join(env.repoRoot,'engine','validate_production.py'),'--output',output,'--content',contentFile,'--slide-count','1','--language-mode','en'],{signal}) as Record<string,unknown>;},
      async upload(job,filename,bytes){assert.equal(createHash('sha256').update(bytes).digest('hex'),preview.render_manifest.pptx_sha256);const storageKey=`${job.owner_id}/${job.project_id}/${filename}`;storage.set(storageKey,bytes);return {storageKey};},
    });
    await production.executeClaimedJob(required(await production.claimNextAvailableJob()));
    const response=await fetch(base+projectPath+'/download');assert.equal(response.status,200);
    const delivered=await response.json() as {data:{sha256_checksum:string}};assert.equal(delivered.data.sha256_checksum,preview.render_manifest.pptx_sha256);
    assert.equal((await db.query('SELECT state FROM ai_presentation.projects WHERE id=$1',[f.project.id])).rows[0].state,'delivered');
    assert.equal((await fetch(base+projectPath+'/download',{headers:{'x-test-owner':randomUUID()}})).status,404);
    await db.query('UPDATE ai_presentation.generated_assets SET is_quarantined=TRUE WHERE id=$1',[preview.render_manifest.source_asset_id]);
    assert.equal((await fetch(base+projectPath+'/download')).status,409);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
const previewDeps={
  async render(){const deck=Buffer.from('CONTROLLED preview renderer fixture'),pages=[Buffer.from('CONTROLLED PNG fixture')];return {deck,pages,manifest:{renderer:'TEST DOUBLE',template:'corporate_slate-v1',pptx_sha256:createHash('sha256').update(deck).digest('hex'),page_sha256:pages.map(bytes=>createHash('sha256').update(bytes).digest('hex')),slide_count:1,desktop_powerpoint:'UNVERIFIED' as const}};},
  async upload(job:{id:string},file:{name:string}){return {storageKey:`fixture/${job.id}/${file.name}`};},
};

test('preview starts atomically enforce two project slots across concurrent failures',async()=>{
  const first=await draftProject(),second=await draftProject(first.owner),third=await draftProject(first.owner);
  for(const f of [first,second,third])await previewJob(f);
  let renders=0;
  const service=createPreviewService(workerDb,{...previewDeps,async render(){renders++;throw new Error('test failure with private content');}});
  const jobs=await Promise.all([service.claim(),service.claim(),service.claim()]);
  assert.equal(jobs.filter(Boolean).length,3);
  await Promise.allSettled(jobs.map(job=>service.execute(required(job))));
  assert.equal(renders,2);
  assert.equal((await db.query('SELECT free_preview_projects_used FROM ai_presentation.users WHERE id=$1',[first.owner])).rows[0].free_preview_projects_used,2);
  assert.equal((await db.query("SELECT count(*)::integer n FROM ai_presentation.jobs WHERE error_code='PREVIEW_PROJECT_LIMIT' AND owner_id=$1",[first.owner])).rows[0].n,1);
});

test('automatic preview retries count once; requested revisions count even on failure and stop at two',async()=>{
  const f=await draftProject();const original=await previewJob(f,2);let fail=true;
  const service=createPreviewService(workerDb,{...previewDeps,async render(){if(fail)throw new Error('test');return previewDeps.render();}});
  await assert.rejects(service.execute(required(await service.claim())));
  await db.query('UPDATE ai_presentation.jobs SET next_retry_at=now() WHERE id=$1',[original.id]);fail=false;
  await service.execute(required(await service.claim()));
  assert.equal((await db.query('SELECT free_preview_projects_used FROM ai_presentation.users WHERE id=$1',[f.owner])).rows[0].free_preview_projects_used,1);
  assert.equal((await db.query('SELECT preview_revisions_used FROM ai_presentation.projects WHERE id=$1',[f.project.id])).rows[0].preview_revisions_used,0);
  fail=true;
  for(let i=0;i<3;i++){await previewJob(f);await assert.rejects(service.execute(required(await service.claim())));}
  assert.equal((await db.query('SELECT preview_revisions_used FROM ai_presentation.projects WHERE id=$1',[f.project.id])).rows[0].preview_revisions_used,2);
  await assert.rejects(asUser(f.owner,async client=>{await client.query('UPDATE ai_presentation.projects SET preview_revisions_used=0 WHERE id=$1',[f.project.id]);}),/PREVIEW_QUOTA_SERVER_ONLY/);
  await assert.rejects(asUser(f.owner,async client=>{await client.query('UPDATE ai_presentation.users SET free_preview_projects_used=0 WHERE id=$1',[f.owner]);}),/permission denied/);
  assert.equal((await db.query("SELECT count(*)::integer n FROM ai_presentation.jobs WHERE project_id=$1 AND error_code='PREVIEW_REVISION_LIMIT'",[f.project.id])).rows[0].n,1);
});

test('reclaimed preview fences old completion and does not double charge the slot',async()=>{
  const f=await draftProject();const original=await previewJob(f,3);let replacement:Awaited<ReturnType<ReturnType<typeof createPreviewService>['claim']>>;
  let once=false;
  const service=createPreviewService(workerDb,{...previewDeps,async render(){if(!once){once=true;await expire(original.id);replacement=await service.claim();}return previewDeps.render();}});
  await assert.rejects(service.execute(required(await service.claim())),LeaseLost);
  assert.equal((await db.query('SELECT count(*)::integer n FROM ai_presentation.generated_assets WHERE job_id=$1',[original.id])).rows[0].n,0);
  await service.execute(required(replacement!));
  assert.equal((await getJob(original.id)).status,'completed');
  assert.equal((await db.query('SELECT free_preview_projects_used FROM ai_presentation.users WHERE id=$1',[f.owner])).rows[0].free_preview_projects_used,1);
});

test('preview heartbeat protects long rendering and final-attempt crashes become terminal',async()=>{
  const f=await draftProject();await previewJob(f);
  const service=createPreviewService(workerDb,{...previewDeps,async render(){await delay(1300);assert.equal(await service.claim(),null);return previewDeps.render();}},{leaseSeconds:1,heartbeatMs:100});
  await service.execute(required(await service.claim()));
  const crashed=await previewJob(f);required(await service.claim());await expire(crashed.id);
  assert.equal(await service.claim(),null);
  assert.equal((await getJob(crashed.id)).status,'quarantined');
  assert.equal((await db.query('SELECT state,preview_revisions_used FROM ai_presentation.projects WHERE id=$1',[f.project.id])).rows[0].state,'preview_revision_requested');
});

test('storage RLS hides unpaid source files and prevents browser writes even under a broad shared policy',async()=>{
  const f=await draftProject();await previewJob(f);
  const previews=createPreviewService(workerDb,previewDeps);await previews.execute(required(await previews.claim()));
  const assets=(await db.query('SELECT * FROM ai_presentation.generated_assets WHERE project_id=$1',[f.project.id])).rows;
  for(const asset of assets)await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('private-presentations',$1)",[asset.storage_key]);
  const source=assets.find(asset=>asset.asset_type==='pptx_deck'),image=assets.find(asset=>asset.asset_type==='preview_image');assert.ok(source&&image);
  const visible=(owner:string,key:string)=>asUser(owner,async client=>(await client.query('SELECT * FROM storage.objects WHERE name=$1',[key])).rowCount);
  assert.equal(await visible(f.owner,source.storage_key),0);assert.equal(await visible(f.owner,image.storage_key),1);
  assert.equal(await visible(randomUUID(),image.storage_key),0);
  assert.equal(await asUser(f.owner,async client=>(await client.query("UPDATE storage.objects SET name='overwritten' WHERE name=$1",[image.storage_key])).rowCount),0);
  assert.equal(await asUser(f.owner,async client=>(await client.query('DELETE FROM storage.objects WHERE name=$1',[image.storage_key])).rowCount),0);
  await assert.rejects(asUser(f.owner,async client=>{await client.query("INSERT INTO storage.objects(bucket_id,name) VALUES('private-presentations','forged')");}),/row-level security/);
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('other-app-test','unchanged-by-platform-policy')");
  assert.equal(await visible(f.owner,'unchanged-by-platform-policy'),1);
  const anon=await db.connect();try{await anon.query('BEGIN');await anon.query('SET LOCAL ROLE anon');assert.equal((await anon.query("SELECT * FROM storage.objects WHERE bucket_id='private-presentations'")).rowCount,0);}finally{await anon.query('ROLLBACK');anon.release();}
  const paid=await fixture(f.owner);const job=await enqueue(paid);const production=createJobService(workerDb,dependencies);
  await production.executeClaimedJob(required(await production.claimNextAvailableJob()));
  const delivered=(await db.query('SELECT storage_key FROM ai_presentation.generated_assets WHERE job_id=$1',[job.id])).rows[0];
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('private-presentations',$1)",[delivered.storage_key]);
  assert.equal(await visible(f.owner,delivered.storage_key),1);
  await db.query("UPDATE ai_presentation.payments SET status='refunded' WHERE id=$1",[paid.payment.id]);
  assert.equal(await visible(f.owner,delivered.storage_key),0);
  await db.query('UPDATE ai_presentation.generated_assets SET is_quarantined=TRUE WHERE id=$1',[image.id]);
  assert.equal(await visible(f.owner,image.storage_key),0);
});

test('preview HTTP enqueue replays, isolates owners, protects worker results and returns private image URLs',async()=>{
  const f=await draftProject();const app=express();app.use(express.json());
  app.use((req,_res,next)=>{req.user={id:req.header('x-test-owner')??f.owner,email:null,accessToken:'fixture'};next();});
  app.use(createPreviewsRouter(asUser,async(_token,key)=>`https://storage.test.invalid/${key}`));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');const route=`http://127.0.0.1:${address.port}/projects/${f.project.id}/previews`;
  const body={content_version:1,idempotency_key:randomUUID()};
  const send=()=>fetch(route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{
    const responses=await Promise.all([send(),send(),send()]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,200,202]);
    assert.equal((await fetch(route,{headers:{'x-test-owner':randomUUID()}})).status,404);
    const service=createPreviewService(workerDb,previewDeps);const job=required(await service.claim());
    assert.equal(await asUser(f.owner,async client=>(await client.query("UPDATE ai_presentation.jobs SET status='completed' WHERE id=$1",[job.id])).rowCount),0);
    await assert.rejects(asUser(f.owner,async client=>{await client.query("INSERT INTO ai_presentation.jobs(project_id,owner_id,job_type,idempotency_key,status) VALUES($1,$2,'static_preview',$3,'completed')",[f.project.id,f.owner,randomUUID()]);}),/INVALID_PREVIEW_JOB/);
    await service.execute(job);
    const result=(await (await fetch(route)).json()) as {data:{preview:{status:string;render_manifest:{slide_count:number}};pages:{url:string}[]}};
    assert.equal(result.data.preview.status,'completed');assert.equal(result.data.preview.render_manifest.slide_count,1);
    assert.equal(result.data.pages.length,1);assert.ok(result.data.pages[0]?.url.startsWith('https://storage.test.invalid/'));
    await assert.rejects(db.query("UPDATE ai_presentation.preview_requests SET content_version=99 WHERE job_id=$1",[job.id]),/PREVIEW_SNAPSHOT_IMMUTABLE/);
    const snapshot=(await (await fetch(route)).json()) as {data:{preview:{manifest_sha256:string}}};
    const approvalRoute=route.replace('/previews','/approve-preview');
    const approve=(overrides:object={},owner=f.owner)=>fetch(approvalRoute,{method:'POST',headers:{'content-type':'application/json','x-test-owner':owner},body:JSON.stringify({preview_job_id:job.id,content_version:1,manifest_sha256:snapshot.data.preview.manifest_sha256,confirmed:true,...overrides})});
    assert.equal((await approve({confirmed:false})).status,400);
    assert.equal((await approve({manifest_sha256:'0'.repeat(64)})).status,409);
    assert.equal((await approve({},randomUUID())).status,404);
    await db.query('UPDATE ai_presentation.generated_assets SET is_quarantined=TRUE WHERE job_id=$1',[job.id]);
    assert.equal((await approve()).status,409);
    await db.query('UPDATE ai_presentation.generated_assets SET is_quarantined=FALSE WHERE job_id=$1',[job.id]);
    assert.deepEqual((await Promise.all([approve(),approve()])).map(response=>response.status).sort(),[200,201]);
    assert.equal((await db.query('SELECT state FROM ai_presentation.projects WHERE id=$1',[f.project.id])).rows[0].state,'design_approved');
    await assert.rejects(db.query('UPDATE ai_presentation.preview_approvals SET content_version=2 WHERE project_id=$1',[f.project.id]),/PREVIEW_APPROVAL_IMMUTABLE/);
    await assert.rejects(asUser(f.owner,async client=>{await client.query('INSERT INTO ai_presentation.content_drafts(project_id,version,content) VALUES($1,2,$2)',[f.project.id,JSON.stringify(previewContent)]);}),/CONTENT_DRAFT_LOCKED/);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
async function expire(id: string) { await db.query("UPDATE ai_presentation.jobs SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [id]); }
function required<T>(value: T | null): T { assert.ok(value); return value; }

test('concurrent PostgreSQL claims have one winner', async () => {
  const job = await enqueue(await fixture());
  const service = createJobService(workerDb, dependencies);
  const claims = await Promise.all(Array.from({ length: 8 }, () => service.claimNextAvailableJob()));
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal((await getJob(job.id)).attempts, 1);
});
test('scoped worker claims leave unrelated jobs and exhausted rows untouched', async () => {
  const target = await enqueue(await fixture());
  const unrelated = await enqueue(await fixture());
  await db.query('UPDATE ai_presentation.jobs SET attempts = max_attempts WHERE id = $1', [unrelated.id]);
  const service = createJobService(workerDb, dependencies);

  const claimed = required(await service.claimNextAvailableJob(target.id));
  assert.equal(claimed.id, target.id);
  assert.equal((await getJob(target.id)).status, 'running');
  assert.equal(await service.claimNextAvailableJob(randomUUID()), null);
  const untouched = await getJob(unrelated.id);
  assert.equal(untouched.status, 'queued');
  assert.equal(untouched.attempts, untouched.max_attempts);
});
test('crash recovery fences an older attempt from renewal, completion and failure', async () => {
  const job = await enqueue(await fixture());
  const service = createJobService(workerDb, dependencies);
  const first = required(await service.claimNextAvailableJob());
  await expire(job.id);
  const second = required(await service.claimNextAvailableJob());
  assert.equal(second.attempts, 2);
  await assert.rejects(service.renew(first), LeaseLost);
  await assert.rejects(service.executeClaimedJob(first), LeaseLost);
  assert.equal((await getJob(job.id)).status, 'running');
  await service.executeClaimedJob(second);
  assert.equal((await getJob(job.id)).status, 'completed');
  assert.equal(uploads, 1);
});
test('long generation renews its lease and cannot be reclaimed', async () => {
  await enqueue(await fixture());
  let generated = false;
  const service = createJobService(workerDb, { ...dependencies,
    async generate(input, output, signal) {
      await delay(1300); generated = true;
      assert.equal(await service.claimNextAvailableJob(), null);
      await dependencies.generate(input, output, signal);
    },
  }, { leaseSeconds: 1, heartbeatMs: 100 });
  await service.executeClaimedJob(required(await service.claimNextAvailableJob()));
  assert.equal(generated, true);
});
test('lease lost during upload cannot publish an asset or poison the new claim', async () => {
  const job = await enqueue(await fixture());
  let replacement: JobRow | null = null;
  const service = createJobService(workerDb, { ...dependencies,
    async upload(current, filename, bytes, signal) {
      await expire(current.id);
      replacement = await service.claimNextAvailableJob();
      return dependencies.upload(current, filename, bytes, signal);
    },
  });
  await assert.rejects(service.executeClaimedJob(required(await service.claimNextAvailableJob())), LeaseLost);
  assert.ok(replacement);
  assert.equal((await getJob(job.id)).attempts, 2);
  assert.equal((await getJob(job.id)).status, 'running');
  assert.equal((await db.query('SELECT * FROM ai_presentation.generated_assets WHERE job_id=$1', [job.id])).rowCount, 0);
});
test('failed validation blocks storage and delivery', async () => {
  const job = await enqueue(await fixture());
  const service = createJobService(workerDb, { ...dependencies, async validate() { return { passed: false }; } });
  await assert.rejects(service.executeClaimedJob(required(await service.claimNextAvailableJob())), /OUTPUT_VALIDATION_FAILED/);
  assert.equal(uploads, 0);
  assert.equal((await getJob(job.id)).output_asset_id, null);
});
test('revoked and mismatched entitlements fail before generation', async () => {
  for (const mismatch of [false, true]) {
    const f = await fixture(); const job = await enqueue(f);
    if (mismatch) {
      const other = await fixture(f.owner);
      await db.query('UPDATE ai_presentation.jobs SET design_spec_id=$2 WHERE id=$1', [job.id, other.spec.id]);
    } else await db.query("UPDATE ai_presentation.entitlements SET status='revoked' WHERE id=$1", [f.entitlement.id]);
    const service = createJobService(workerDb, dependencies);
    await assert.rejects(service.executeClaimedJob(required(await service.claimNextAvailableJob())), /PRODUCTION_SNAPSHOT_MISMATCH/);
  }
  assert.equal(uploads, 0);
});
test('retries back off, stop at the ceiling, and never expose provider details', async () => {
  const job = await enqueue(await fixture());
  const service = createJobService(workerDb, { ...dependencies, async generate() { throw new Error('secret provider content'); } });
  for (let attempt = 1; attempt <= 3; attempt++) {
    await assert.rejects(service.executeClaimedJob(required(await service.claimNextAvailableJob())));
    const current = await getJob(job.id);
    assert.equal(current.attempts, attempt);
    assert.equal(current.status, attempt === 3 ? 'quarantined' : 'failed');
    assert.ok(!current.error_message.includes('secret'));
    if (attempt < 3) {
      const seconds = (new Date(current.next_retry_at).getTime() - Date.now()) / 1000;
      assert.ok(seconds > 30 * 2 ** (attempt - 1) - 3);
      assert.equal(await service.claimNextAvailableJob(), null);
      await db.query("UPDATE ai_presentation.jobs SET next_retry_at=NOW()-INTERVAL '1 second' WHERE id=$1", [job.id]);
    }
  }
  assert.equal(await service.claimNextAvailableJob(), null);
});
test('crash on final attempt is quarantined without a fourth attempt', async () => {
  const job = await enqueue(await fixture());
  await db.query("UPDATE ai_presentation.jobs SET status='running', attempts=3, lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [job.id]);
  const service = createJobService(workerDb, dependencies);
  assert.equal(await service.claimNextAvailableJob(), null);
  assert.equal((await getJob(job.id)).status, 'quarantined');
});
test('real Python generation and validation register byte-accurate output', async () => {
  const f = await fixture(); const job = await enqueue(f);
  let expectedSize = 0; let expectedHash = '';
  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const service = createJobService(workerDb, { ...dependencies,
    async generate(input, output, signal) {
      await runJsonProcess(python, [path.resolve('engine/generate_static_deck.py'), '--title', input.title,
        '--slide-count', String(input.slideCount), '--language-mode', input.languageMode, '--output', output], { signal });
    },
    async validate(output, input, signal) {
      return await runJsonProcess(python, [path.resolve('engine/validate_production.py'), '--output', output,
        '--slide-count', String(input.slideCount), '--language-mode', input.languageMode], { signal }) as Record<string, unknown>;
    },
    async upload(current, filename, bytes, signal) {
      expectedSize = bytes.length;
      expectedHash = createHash('sha256').update(bytes).digest('hex');
      return dependencies.upload(current, filename, bytes, signal);
    },
  });
  await service.executeClaimedJob(required(await service.claimNextAvailableJob()));
  const done = await getJob(job.id);
  assert.equal(done.status, 'completed');
  assert.equal(done.validation_report.passed, true);
  assert.equal(done.validation_report.content_source, 'PLACEHOLDER_NOT_AI_GENERATED');
  const asset = (await db.query('SELECT * FROM ai_presentation.generated_assets WHERE id=$1', [done.output_asset_id])).rows[0];
  assert.ok(Number(asset.size_bytes) > 1000);
  assert.equal(Number(asset.size_bytes), expectedSize);
  assert.equal(asset.sha256_checksum, expectedHash);
});

test('a late failed attempt cannot mark its replacement as failed', async () => {
  const job = await enqueue(await fixture());
  const service = createJobService(workerDb, { ...dependencies, async generate() {
    await expire(job.id);
    const replacement = required(await service.claimNextAvailableJob());
    assert.equal(replacement.attempts, 2);
    throw new Error('Obsolete attempt failed');
  } });
  await assert.rejects(service.executeClaimedJob(required(await service.claimNextAvailableJob())));
  const current = await getJob(job.id);
  assert.equal(current.status, 'running');
  assert.equal(current.attempts, 2);
  assert.equal(current.error_code, null);
});

test('generation uses the locked slide count instead of mutable project metadata', async () => {
  const f = await fixture(); await enqueue(f);
  await db.query('UPDATE ai_presentation.projects SET slide_count=9 WHERE id=$1', [f.project.id]);
  const service = createJobService(workerDb, { ...dependencies, async generate(input, output, signal) {
    assert.equal(input.slideCount, 3);
    await dependencies.generate(input, output, signal);
  } });
  await service.executeClaimedJob(required(await service.claimNextAvailableJob()));
});

test('HTTP enqueue is immediate, concurrent replay is idempotent, and RLS denies another owner', async () => {
  const f = await fixture(); const outsider = randomUUID();
  const context = async <T>(owner: string, fn: (client: import('pg').PoolClient) => Promise<T>) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner })]);
      const result = await fn(client); await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.header('x-test-owner') ?? f.owner, email: null, accessToken: 'test' }; next(); });
  app.use(createProduceRouter({ withUserContext: context, async createSignedDownloadUrl() { throw new Error('No storage in this local test'); } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const send = (key: string, owner = f.owner) => fetch(`${base}/projects/${f.project.id}/produce`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-owner': owner }, body: JSON.stringify({ idempotency_key: key }),
  });
  try {
    const results = await Promise.all([send('same-key'), send('same-key')]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 202]);
    const bodies = await Promise.all(results.map(async (r) => await r.json() as {
      data: { job: { id: string; status: string } };
    }));
    assert.ok(bodies[0] && bodies[1]);
    assert.equal(bodies[0].data.job.id, bodies[1].data.job.id);
    assert.equal(bodies[0].data.job.status, 'queued');
    assert.equal((await send('another-key')).status, 409);
    assert.equal((await send('outsider-key', outsider)).status, 404);
    assert.equal((await db.query('SELECT * FROM ai_presentation.jobs WHERE project_id=$1', [f.project.id])).rowCount, 1);
    await db.query("UPDATE ai_presentation.entitlements SET status='revoked' WHERE id=$1", [f.entitlement.id]);
    assert.equal((await send('unpaid-key')).status, 403);
    await db.query("UPDATE ai_presentation.entitlements SET status='active' WHERE id=$1", [f.entitlement.id]);
    await db.query(`INSERT INTO ai_presentation.design_specs (project_id,version,is_locked,spec_json)
      SELECT project_id,2,TRUE,spec_json FROM ai_presentation.design_specs WHERE id=$1`, [f.spec.id]);
    assert.equal((await send('mismatched-snapshot')).status, 409);
    // Historical "completed" metadata is not independent validation evidence.
    const jobId = bodies[0].data.job.id;
    const legacyAsset = (await db.query(`INSERT INTO ai_presentation.generated_assets
      (project_id,job_id,owner_id,asset_type,storage_key,filename,mime_type,size_bytes,sha256_checksum)
      VALUES ($1,$2,$3,'pptx_deck',$4,'legacy.pptx','application/octet-stream',10,'unverified') RETURNING id`,
      [f.project.id,jobId,f.owner,randomUUID()])).rows[0];
    await db.query("UPDATE ai_presentation.jobs SET status='completed',output_asset_id=$2 WHERE id=$1", [jobId,legacyAsset.id]);
    assert.equal((await fetch(`${base}/projects/${f.project.id}/download`)).status, 409);
  } finally { await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); }
});
const PAYMENT_TEST_SECRET = 'local-payment-tests-not-a-real-key';
const processPayment = createSandboxPaymentService(webhookDb, PAYMENT_TEST_SECRET);
function delivery(f: Awaited<ReturnType<typeof fixture>>, extra: Record<string, unknown> = {}) {
  const raw = Buffer.from(JSON.stringify({ event_id: randomUUID(), provider_session_id: f.payment.provider_session_id,
    status: 'VALID', amount_bdt: 75, currency: 'BDT', ...extra }));
  return { raw, signature: createHmac('sha256', PAYMENT_TEST_SECRET).update(raw).digest('hex') };
}
async function deliver(f: Awaited<ReturnType<typeof fixture>>, extra: Record<string, unknown> = {}) {
  const event = delivery(f, extra); return processPayment(event.raw, event.signature);
}
async function pendingFixture(expires = new Date(Date.now() + 86_400_000).toISOString()) {
  return fixture(randomUUID(), expires, false);
}
async function paymentRow(id: string) { return (await db.query('SELECT * FROM ai_presentation.payments WHERE id=$1', [id])).rows[0]; }

test('forged webhook cannot reserve an event ID; authentic delivery still grants access', async () => {
  const f = await pendingFixture(); const event = delivery(f);
  await assert.rejects(processPayment(event.raw, '0'.repeat(64)), /signature verification failed/);
  const payload = JSON.parse(event.raw.toString()) as { event_id: string };
  assert.equal((await db.query('SELECT * FROM ai_presentation.payment_webhook_events WHERE provider_event_id=$1', [payload.event_id])).rowCount, 0);
  assert.equal((await processPayment(event.raw, event.signature)).status, 200);
  assert.equal((await paymentRow(f.payment.id)).status, 'verified');
  assert.equal((await db.query('SELECT * FROM ai_presentation.entitlements WHERE project_id=$1', [f.project.id])).rowCount, 1);
  assert.equal((await db.query('SELECT status FROM ai_presentation.quotes WHERE id=$1', [f.quote.id])).rows[0].status, 'paid');
});

test('an authentic webhook repairs an old invalid-signature ledger reservation', async () => {
  const f = await pendingFixture(); const id = randomUUID();
  await db.query(`INSERT INTO ai_presentation.payment_webhook_events
    (provider,provider_event_id,signature_valid,payload_sha256,raw_payload)
    VALUES ('mock_sandbox',$1,FALSE,$2,'{}')`, [id, '0'.repeat(64)]);
  assert.equal((await deliver(f, { event_id: id })).status, 200);
  const row = (await db.query('SELECT * FROM ai_presentation.payment_webhook_events WHERE provider_event_id=$1', [id])).rows[0];
  assert.equal(row.signature_valid, true);
  assert.equal(row.processing_outcome, 'verified');
});

test('concurrent identical events grant one entitlement and write one audit record', async () => {
  const f = await pendingFixture(); const event = delivery(f);
  const responses = await Promise.all(Array.from({ length: 6 }, () => processPayment(event.raw, event.signature)));
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal((await db.query('SELECT * FROM ai_presentation.entitlements WHERE project_id=$1', [f.project.id])).rowCount, 1);
  assert.equal((await db.query('SELECT * FROM ai_presentation.audit_logs WHERE target_id=$1', [f.payment.id])).rowCount, 1);
});

test('concurrent different events for one session grant once and never regress project progress', async () => {
  const f = await pendingFixture();
  const results = await Promise.all([deliver(f), deliver(f), deliver(f, { status: 'FAILED' })]);
  assert.ok(results.every((response) => response.status === 200));
  assert.equal((await paymentRow(f.payment.id)).status, 'verified');
  assert.equal((await db.query('SELECT * FROM ai_presentation.entitlements WHERE project_id=$1', [f.project.id])).rowCount, 1);
  await db.query("UPDATE ai_presentation.projects SET state='delivered' WHERE id=$1", [f.project.id]);
  await deliver(f); await deliver(f, { status: 'FAILED' });
  assert.equal((await db.query('SELECT state FROM ai_presentation.projects WHERE id=$1', [f.project.id])).rows[0].state, 'delivered');
});

test('reused authentic event ID with changed content is rejected', async () => {
  const f = await pendingFixture(); const id = randomUUID();
  await deliver(f, { event_id: id });
  await assert.rejects(deliver(f, { event_id: id, amount_bdt: 76 }), /already used for different content/);
  assert.equal((await paymentRow(f.payment.id)).status, 'verified');
});

test('amount mismatch remains a 409 on replay and cannot grant entitlement', async () => {
  const f = await pendingFixture(); const event = delivery(f, { amount_bdt: 76 });
  assert.equal((await processPayment(event.raw, event.signature)).status, 409);
  assert.equal((await processPayment(event.raw, event.signature)).status, 409);
  assert.equal((await paymentRow(f.payment.id)).status, 'pending');
  assert.equal((await db.query('SELECT * FROM ai_presentation.entitlements WHERE project_id=$1', [f.project.id])).rowCount, 0);
});

test('expired, superseded and cancelled orders do not gain production access', async () => {
  for (const scenario of ['expired', 'superseded', 'cancelled']) {
    const f = await pendingFixture(scenario === 'expired' ? new Date(Date.now() - 60_000).toISOString() : undefined);
    if (scenario === 'superseded') await db.query("UPDATE ai_presentation.quotes SET status='superseded' WHERE id=$1", [f.quote.id]);
    if (scenario === 'cancelled') await db.query("UPDATE ai_presentation.projects SET state='cancelled' WHERE id=$1", [f.project.id]);
    assert.equal((await deliver(f)).status, 409);
    assert.equal((await db.query('SELECT * FROM ai_presentation.entitlements WHERE project_id=$1', [f.project.id])).rowCount, 0);
  }
});

test('provider events cannot resurrect a refunded payment or revoked entitlement', async () => {
  const f = await fixture();
  await db.query("UPDATE ai_presentation.entitlements SET status='revoked' WHERE id=$1", [f.entitlement.id]);
  await deliver(f);
  assert.equal((await db.query('SELECT status FROM ai_presentation.entitlements WHERE id=$1', [f.entitlement.id])).rows[0].status, 'revoked');
  await db.query("UPDATE ai_presentation.payments SET status='refunded' WHERE id=$1", [f.payment.id]);
  await deliver(f);
  assert.equal((await paymentRow(f.payment.id)).status, 'refunded');
});

test('signed invalid payloads are rejected before any database mutation', async () => {
  const f = await pendingFixture();
  for (const extra of [{ amount_bdt: -1 }, { amount_bdt: 1.5 }, { amount_bdt: null }, { currency: 'USD' },
    { event_id: 'x'.repeat(129) }, { provider_session_id: '' }, { status: 'REFUND' }]) {
    await assert.rejects(deliver(f, extra), /invalid fields/);
  }
  assert.equal((await db.query('SELECT * FROM ai_presentation.payment_webhook_events WHERE payment_id=$1', [f.payment.id])).rowCount, 0);
});

test('database prevents quote rebinding, payment repricing and locked-spec unlock', async () => {
  const f = await fixture(); const other = await fixture();
  for (const [sql, params, expected] of [
    ['UPDATE ai_presentation.quotes SET design_spec_id=$2 WHERE id=$1', [f.quote.id, other.spec.id], /IMMUTABLE_QUOTE_SNAPSHOT/],
    ['UPDATE ai_presentation.quotes SET expires_at=NOW() WHERE id=$1', [f.quote.id], /IMMUTABLE_QUOTE_SNAPSHOT/],
    ['UPDATE ai_presentation.payments SET quote_amount=76 WHERE id=$1', [f.payment.id], /IMMUTABLE_PAYMENT_SNAPSHOT/],
    ["UPDATE ai_presentation.payments SET status='failed' WHERE id=$1", [f.payment.id], /INVALID_PAYMENT_STATE_TRANSITION/],
    ['UPDATE ai_presentation.design_specs SET is_locked=FALSE WHERE id=$1', [f.spec.id], /IMMUTABLE_DESIGN_SPEC/],
    ['UPDATE ai_presentation.design_specs SET project_id=$2 WHERE id=$1', [f.spec.id, other.project.id], /IMMUTABLE_DESIGN_SPEC/],
  ] as const) await assert.rejects(db.query(sql, [...params]), expected);
});

test('production reads immutable title and language and rejects unsigned payments', async () => {
  const f = await fixture(); await enqueue(f);
  await db.query("UPDATE ai_presentation.projects SET title='Changed later',language_mode='bn' WHERE id=$1", [f.project.id]);
  const service = createJobService(workerDb, { ...dependencies, async generate(input, output, signal) {
    assert.equal(input.title, 'Local worker test'); assert.equal(input.languageMode, 'en');
    await dependencies.generate(input, output, signal);
  } });
  await service.executeClaimedJob(required(await service.claimNextAvailableJob()));
  const unsigned = await fixture(); await enqueue(unsigned);
  await db.query('UPDATE ai_presentation.payments SET webhook_signature_verified=FALSE WHERE id=$1', [unsigned.payment.id]);
  await assert.rejects(service.executeClaimedJob(required(await service.claimNextAvailableJob())), /PRODUCTION_SNAPSHOT_MISMATCH/);
});

test('revocation during upload blocks final asset publication', async () => {
  const f = await fixture(); const job = await enqueue(f);
  const service = createJobService(workerDb, { ...dependencies, async upload(current, filename, bytes, signal) {
    await db.query("UPDATE ai_presentation.entitlements SET status='revoked' WHERE id=$1", [f.entitlement.id]);
    return dependencies.upload(current, filename, bytes, signal);
  } });
  await assert.rejects(service.executeClaimedJob(required(await service.claimNextAvailableJob())), /PRODUCTION_SNAPSHOT_MISMATCH/);
  assert.equal((await db.query('SELECT * FROM ai_presentation.generated_assets WHERE job_id=$1', [job.id])).rowCount, 0);
});

test('actual HTTP webhook route verifies raw bytes and uses the hardened service', async () => {
  const f = await pendingFixture(); const event = delivery(f);
  const app = express();
  app.use(express.json({ verify(req, _res, bytes) { (req as unknown as { rawBody: Buffer }).rawBody = bytes; } }));
  app.use(createWebhooksRouter(processPayment));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const send = (signature: string) => fetch(`${base}/webhooks/mock_sandbox`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mock-signature': signature }, body: event.raw });
    assert.equal((await send('bad')).status, 401);
    assert.equal((await send(event.signature)).status, 200);
    assert.equal((await send(event.signature)).status, 200);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
test('checkout serializes concurrent requests and permits idempotent replay after payment', async () => {
  const f = await pendingFixture();
  await db.query('DELETE FROM ai_presentation.payments WHERE id=$1', [f.payment.id]);
  const context = async <T>(owner: string, fn: (client: import('pg').PoolClient) => Promise<T>) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner })]);
      const result = await fn(client); await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.header('x-test-owner') ?? f.owner, email: null, accessToken: 'test' }; next(); });
  app.use(createCheckoutRouter(context));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const send = (key: string, owner = f.owner) => fetch(`http://127.0.0.1:${address.port}/checkout/session`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-owner': owner },
    body: JSON.stringify({ quote_id: f.quote.id, idempotency_key: key }),
  });
  try {
    const responses = await Promise.all([send('checkout-race-a'),send('checkout-race-b')]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200,201]);
    const payments = (await db.query('SELECT * FROM ai_presentation.payments WHERE quote_id=$1', [f.quote.id])).rows;
    assert.equal(payments.length, 1); assert.ok(payments[0]);
    const paidFixture = { ...f, payment: payments[0] };
    await deliver(paidFixture);
    assert.equal((await send(payments[0].idempotency_key)).status, 200);
    assert.equal((await send('new-checkout-after-paid')).status, 409);
    assert.equal((await send('outsider-checkout', randomUUID())).status, 404);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
test('duplicate event semantics survive JSON key order and whitespace changes', async () => {
  const f = await pendingFixture(); const original = delivery(f);
  await processPayment(original.raw, original.signature);
  const parsed = JSON.parse(original.raw.toString()) as Record<string, unknown>;
  const reordered = Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(parsed).reverse()), null, 2));
  const signature = createHmac('sha256', PAYMENT_TEST_SECRET).update(reordered).digest('hex');
  assert.equal((await processPayment(reordered, signature)).status, 200);
  assert.equal((await db.query('SELECT * FROM ai_presentation.payment_webhook_events WHERE payment_id=$1', [f.payment.id])).rowCount, 1);
});
test('HTTP quote-to-payment-to-queued-production preserves quoted metadata across later edits', async () => {
  const owner = randomUUID();
  await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [owner, `${owner}@test.invalid`]);
  const context = async <T>(id: string, fn: (client: import('pg').PoolClient) => Promise<T>) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id })]);
      const result = await fn(client); await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const app = express();
  app.use(express.json({ verify(req, _res, raw) { (req as unknown as { rawBody: Buffer }).rawBody = raw; } }));
  app.use((req, _res, next) => { req.user = { id: owner, email: null, accessToken: 'test' }; next(); });
  app.use(createProjectsRouter(context)); app.use(createCheckoutRouter(context));
  app.use(createWebhooksRouter(processPayment));
  app.use(createProduceRouter({ withUserContext: context, async createSignedDownloadUrl() { return 'http://local-storage-test.invalid/deck'; } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const post = async (route: string, body: object, status: number) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, status);
    return await response.json() as { data: { project?: { id: string }; quote?: { id: string; quote_amount: number };
      payment?: { provider_session_id: string }; job?: { id: string } } };
  };
  try {
    const created = await post('/projects', { title: 'Frozen presentation', slide_count: 3, language_mode: 'en', motion_tier_requested: 'static' }, 201);
    const project = created.data.project; assert.ok(project);
    await post(`/projects/${project.id}/motion`, { motion_tier: 'static', transition_id: null, intensity: null }, 200);
    const quoted = await post(`/projects/${project.id}/quote`, {}, 201);
    assert.equal(quoted.data.quote?.quote_amount, 75);
    await db.query("UPDATE ai_presentation.projects SET title='New mutable title',language_mode='bn',slide_count=9 WHERE id=$1", [project.id]);
    const requoted = await post(`/projects/${project.id}/quote`, {}, 201);
    assert.equal(requoted.data.quote?.quote_amount, 75);
    const checkout = await post('/checkout/session', { quote_id: requoted.data.quote?.id, idempotency_key: randomUUID() }, 201);
    const raw = Buffer.from(JSON.stringify({ event_id: randomUUID(), provider_session_id: checkout.data.payment?.provider_session_id,
      status: 'VALID', amount_bdt: 75, currency: 'BDT' }));
    const response = await fetch(base + '/webhooks/mock_sandbox', { method: 'POST', headers: {
      'content-type': 'application/json', 'x-mock-signature': createHmac('sha256', PAYMENT_TEST_SECRET).update(raw).digest('hex'),
    }, body: raw });
    assert.equal(response.status, 200);
    await post(`/projects/${project.id}/quote`, {}, 409);
    const produced = await post(`/projects/${project.id}/produce`, { idempotency_key: randomUUID() }, 202);
    const service = createJobService(workerDb, { ...dependencies, async generate(input, output, signal) {
      assert.deepEqual(input, { title: 'Frozen presentation', slideCount: 3, languageMode: 'en' });
      await dependencies.generate(input, output, signal);
    } });
    const claimed = required(await service.claimNextAvailableJob());
    assert.equal(claimed.id, produced.data.job?.id);
    await service.executeClaimedJob(claimed);
    assert.equal((await getJob(claimed.id)).status, 'completed');
    assert.equal((await fetch(base + `/projects/${project.id}/download`)).status, 200);
    await db.query("UPDATE ai_presentation.payments SET status='refunded' WHERE project_id=$1", [project.id]);
    assert.equal((await fetch(base + `/projects/${project.id}/download`)).status, 409);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});


test('POST /checkout/confirm verifies Bangla QR and Remitly payments and unlocks production', async () => {
  const owner = randomUUID();
  await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [owner, `${owner}@test.invalid`]);
  const context = async <T>(id: string, fn: (client: import('pg').PoolClient) => Promise<T>) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id })]);
      const result = await fn(client); await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: owner, email: null, accessToken: 'test' }; next(); });
  app.use(createProjectsRouter(context));
  app.use(createCheckoutRouter(context, () => commercePolicy('test'), webhookDb));
  app.use(createProduceRouter({ withUserContext: context, async createSignedDownloadUrl() { return 'http://127.0.0.1/api/download/private'; } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const post = async (route: string, body: object, expectedStatus: number) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, expectedStatus);
    return await response.json() as { data: any };
  };
  try {
    const created = await post('/projects', { title: 'Bangla QR Deck', slide_count: 4, language_mode: 'bn', motion_tier_requested: 'static' }, 201);
    const projectId = created.data.project.id;
    await post(`/projects/${projectId}/motion`, { motion_tier: 'static', transition_id: null, intensity: null }, 200);
    const quoted = await post(`/projects/${projectId}/quote`, {}, 201);
    const quoteId = quoted.data.quote.id;
    const key = randomUUID();
    const confirmed = await post('/checkout/confirm', { quote_id: quoteId, payment_method: 'bangla_qr', reference: 'TRX_BANGLA_QR_123', idempotency_key: key }, 201);
    assert.equal(confirmed.data.status, 'verified');
    assert.equal(confirmed.data.payment.provider, 'bangla_qr');
    const replayed = await post('/checkout/confirm', { quote_id: quoteId, payment_method: 'bangla_qr', reference: 'TRX_BANGLA_QR_123', idempotency_key: key }, 200);
    assert.equal(replayed.data.payment.id, confirmed.data.payment.id);
    const orderRes = await fetch(`${base}/projects/${projectId}/order`);
    const order = await orderRes.json() as { data: any };
    assert.equal(order.data.can_produce, true);
    assert.equal(order.data.payment.status, 'verified');
    const produced = await post(`/projects/${projectId}/produce`, { idempotency_key: randomUUID() }, 202);
    assert.ok(produced.data.job.id);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
