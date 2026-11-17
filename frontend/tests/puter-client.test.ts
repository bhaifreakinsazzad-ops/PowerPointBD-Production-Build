import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPuterClient, analyzeDeckReadiness, type PuterSDK, type DraftRequest } from '../src/studio/puter-client.ts';
import { parsePresentationResponse, validatePresentation } from '../../shared/presentation.ts';

const document = { version: 1, title: 'Test draft', language: 'en', slides: [{ title: 'Actual topic', bullets: ['A useful point'], notes: 'Check the evidence.' }] };
function fixture() {
  const calls: { messages: unknown; options: Record<string,unknown> }[] = [];
  const sdk: PuterSDK = { auth: { isSignedIn: () => true, async signIn() {}, async getUser() { return { username: 'test' }; } },
    ai: { async listModels() { return [{ id: 'live-test-model', provider: 'test', name: 'Test model' }]; },
      async chat(messages,options) { calls.push({ messages,options }); return { message: { content: JSON.stringify(document) } }; } } };
  const request: DraftRequest = { brief: 'A test topic', audience: 'Developers', language: 'en', count: 1,
    model: { id: 'live-test-model',provider:'test',name:'Test model' }, consent:true };
  return { sdk,request,calls };
}
test('Puter uses the discovered catalogue choice, validates output and never sends payment controls',async()=>{
  const f=fixture(), client=createPuterClient(f.sdk); await client.listModels();
  assert.deepEqual(await client.generate(f.request),document);
  assert.equal(f.calls.length,1); assert.equal(f.calls[0]?.options.provider,'test');
  assert.equal(f.calls[0]?.options.normalize,true); assert.ok(f.calls[0]?.options.signal instanceof AbortSignal);
  assert.ok(!JSON.stringify(f.calls[0]?.messages).includes('owner_id'));
});
test('no consent, no session and unknown model do not call paid generation',async()=>{
  const f=fixture(),client=createPuterClient(f.sdk); await client.listModels();
  await assert.rejects(client.generate({...f.request,consent:false}),/CONSENT_REQUIRED/);
  await assert.rejects(client.generate({...f.request,model:{...f.request.model,id:'invented'}}),/MODEL_NOT_AVAILABLE/);
  f.sdk.auth.isSignedIn=()=>false;
  await assert.rejects(client.generate(f.request),/PUTER_SIGN_IN_REQUIRED/);
  assert.equal(f.calls.length,0);
});
test('provider failure does not turn into a successful fixture or leak provider data',async()=>{
  const f=fixture(); f.sdk.ai.chat=async()=>{throw new Error('secret auth token and customer text');};
  const client=createPuterClient(f.sdk); await client.listModels();
  await assert.rejects(client.generate(f.request),/^Error: PUTER_GENERATION_FAILED$/);
});
test('malformed or wrong-count output is rejected',async()=>{
  const f=fixture(); f.sdk.ai.chat=async()=>({message:{content:'not JSON'}});
  const client=createPuterClient(f.sdk); await client.listModels();
  await assert.rejects(client.generate(f.request),/AI_OUTPUT_INVALID/);
  assert.throws(()=>parsePresentationResponse(JSON.stringify(document),2),/AI_OUTPUT_INVALID/);
  assert.throws(()=>validatePresentation({...document,slides:[{title:'x',bullets:Array(7).fill('x')}]}));
});
test('cancellation propagates to Puter and prevents duplicate concurrent generation',async()=>{
  const f=fixture(); let notify: ()=>void=()=>{};
  const started=new Promise<void>((resolve)=>{notify=resolve;});
  f.sdk.ai.chat=async(_messages,options)=>new Promise((_resolve,reject)=>{
    const signal=options.signal as AbortSignal; notify();
    signal.addEventListener('abort',()=>reject(new Error('provider cancelled')),{once:true});
  });
  const client=createPuterClient(f.sdk); await client.listModels();
  const controller=new AbortController(); const generation=client.generate(f.request,controller.signal); await started;
  await assert.rejects(client.generate(f.request),/GENERATION_IN_PROGRESS/); controller.abort();
  await assert.rejects(generation,/GENERATION_CANCELLED/);
});
test('catalogue failure remains unavailable and cannot silently select a fabricated model',async()=>{
  const f=fixture(); f.sdk.ai.listModels=async()=>[];
  await assert.rejects(createPuterClient(f.sdk).listModels(),/MODEL_CATALOGUE_UNAVAILABLE/);
});
test('content normalization excludes control fields and keeps HTML as inert text',()=>{
  const safe=validatePresentation({...document,owner_id:'other',price:0,animation_xml:'<p:timing/>',
    slides:[{title:'<img src=x onerror=alert(1)>',bullets:['Plain text'],notes:''}]});
  assert.equal(safe.slides[0]?.title,'<img src=x onerror=alert(1)>');
  assert.equal('owner_id' in safe,false); assert.equal('animation_xml' in safe,false);
});
test('Puter AI Copilot enhanceSlide validates single-slide refinement and enforces consent/auth/model',async()=>{
  const f=fixture(), client=createPuterClient(f.sdk); await client.listModels();
  const slideRequest={deckTitle:'Board Update',language:'bilingual' as const,slideIndex:0,slide:document.slides[0]!,action:'executive_polish' as const,model:f.request.model,consent:true};
  const enhanced=await client.enhanceSlide(slideRequest);
  assert.deepEqual(enhanced,document.slides[0]);
  await assert.rejects(client.enhanceSlide({...slideRequest,consent:false}),/CONSENT_REQUIRED/);
  await assert.rejects(client.enhanceSlide({...slideRequest,model:{...f.request.model,id:'unknown'}}),/MODEL_NOT_AVAILABLE/);
});
test('analyzeDeckReadiness calculates Static and Smooth BDT pricing, Bengali script detection, and motion policy',()=>{
  const report=analyzeDeckReadiness({
    version:1,title:'বাংলাদেশ বোর্ড ব্রিফ',language:'bilingual',
    slides:[
      {title:'বাংলাদেশ Executive Summary',bullets:['Point 1','Point 2'],notes:'কথা বলুন স্পষ্টভাবে এবং বোর্ডকে মূল ফলাফল দেখান।'},
      {title:'Metrics Overview',bullets:['A','B','C'],notes:''}
    ]
  },'editorial_bengali');
  assert.equal(report.slideCount,2);
  assert.equal(report.staticTotalBdt,50);
  assert.equal(report.smoothTotalBdt,72);
  assert.equal(report.bengaliSlideCount,1);
  assert.deepEqual(report.recommendedTransitions,['fade','wipe']);
  assert.equal(report.recommendedIntensity,'subtle');
  assert.equal(report.denseSlides.length,0);
  assert.equal(report.notesCoveragePercent,50);
});
