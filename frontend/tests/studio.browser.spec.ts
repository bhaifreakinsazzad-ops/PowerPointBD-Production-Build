import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function draft(page: Page) {
  await page.goto('/qa-studio.html');
  await page.getByRole('button',{name:'Connect Puter',exact:true}).click();
  await page.getByLabel('Presentation brief',{exact:true}).fill('Test a presentation about team collaboration.');
  await page.getByLabel('Slides',{exact:true}).fill('4');
  await page.getByLabel('AI model',{exact:true}).selectOption('1');
  await expect(page.getByRole('button',{name:'Generate draft',exact:true})).toBeDisabled();
  await page.getByLabel('I agree to send this brief').check();
  await page.getByRole('button',{name:'Generate draft',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Test slide 1',exact:true})).toBeVisible();
}
test('keyboard users can skip to the brief, see focus, and reach labeled form/status controls',async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/studio.html');
  const skip=page.getByRole('link',{name:'Skip to presentation brief',exact:true});
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  expect(await skip.evaluate(element=>{
    const rect=element.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&getComputedStyle(element).visibility==='visible';
  })).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#brief')).toBeFocused();
  const unlabeled=await page.locator('main input, main textarea, main select').evaluateAll(controls=>
    controls.filter(control=>!control.labels?.length&&!control.getAttribute('aria-label')&&!control.getAttribute('aria-labelledby'))
      .map(control=>control.id||control.tagName.toLowerCase()));
  expect(unlabeled).toEqual([]);
  for(const selector of ['#status','#project-status','#preview-status','#order-status']){
    await expect(page.locator(selector)).toHaveAttribute('role','status');
    await expect(page.locator(selector)).toHaveAttribute('aria-live','polite');
  }
});
test('draft review, editing and JSON export work without injecting HTML',async({page})=>{
  await page.setViewportSize({width:1536,height:1024}); await draft(page);
  await page.getByRole('button',{name:'Slide 2: Test slide 2',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Test slide 2',exact:true})).toBeVisible();
  await page.getByText('Edit selected slide',{exact:true}).click();
  await page.getByLabel('Slide title',{exact:true}).fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button',{name:'Apply edits',exact:true}).click();
  await expect(page.locator('#slide-title')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#slide-title img')).toHaveCount(0);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download draft JSON',exact:true}).click();
  const download=await downloadPromise; const file=await download.path(); expect(file).toBeTruthy();
  const document=JSON.parse(await readFile(file!,'utf8')); expect(document.slides[1].title).toBe('<img src=x onerror=alert(1)>');
});
test('mobile layout has no horizontal overflow and remains editable',async({page})=>{
  await page.setViewportSize({width:390,height:844}); await draft(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Next',exact:false}).click();
  await expect(page.locator('#slide-position')).toHaveText('2 / 4 slides');
});
test('Three.js renders, selects slides and respects reduced motion',async({page})=>{
  const errors: string[]=[]; page.on('pageerror',(error)=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'}); await page.setViewportSize({width:1280,height:900}); await draft(page);
  await page.getByRole('button',{name:'3D storyboard',exact:false}).click();
  await expect(page.locator('#three-stage canvas')).toBeVisible();
  await page.getByRole('button',{name:'Slide 4: Test slide 4',exact:true}).click();
  await expect(page.locator('#slide-position')).toHaveText('4 / 4 slides');
  await expect(page.getByLabel('Auto orbit',{exact:true})).toBeDisabled();
  await expect(page.getByLabel('Auto orbit',{exact:true})).not.toBeChecked();
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  expect(errors).toEqual([]);
});
test('production studio starts without fake slides or enabled generation',async({page})=>{
  await page.goto('/studio.html');
  await expect(page.getByRole('heading',{name:'Your draft will appear here',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Generate draft',exact:true})).toBeDisabled();
  await expect(page.locator('#thumbnails button')).toHaveCount(0);
  await page.setViewportSize({width:1536,height:1024});
  await expect(page.getByRole('button',{name:'Connect Puter',exact:true})).toBeEnabled();
  await page.screenshot({path:'../artifacts/studio-desktop.png',fullPage:true});
});

test('draft JSON can be resumed and invalid imports preserve the current draft',async({page})=>{
  await page.goto('/qa-studio.html');
  const content = { version:1,title:'Restored presentation',language:'en',slides:[{title:'Restored slide',bullets:['Saved text'],notes:'Saved notes'}] };
  await page.locator('#import-json').setInputFiles({name:'draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(content))});
  await expect(page.locator('#slide-title')).toHaveText('Restored slide');
  await page.locator('#import-json').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('not JSON')});
  await expect(page.locator('#status')).toContainText('Replace the current local draft');
  await page.getByText('Save or resume a project',{exact:true}).click();
  await page.getByLabel('Replace the current local draft when loading a saved project.').check();
  await page.locator('#import-json').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('not JSON')});
  await expect(page.locator('#status')).toContainText('not a valid PowerPointBD draft');
  await expect(page.locator('#slide-title')).toHaveText('Restored slide');
});

test('account creation and reset requests use email verification and non-enumerating recovery messages',async({page})=>{
  const id='cccccccc-cccc-cccc-cccc-cccccccccccc',email='new-user@example.invalid';
  let signup=false,recovery=false,passwordUpdated=false,verifierExchanged=false,recoveryRedirect='';
  const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',aud:'authenticated',email})).toString('base64url')}.fixture`;
  await page.route('https://auth.test.invalid/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname.endsWith('/token')){
      expect(url.searchParams.get('grant_type')).toBe('pkce');expect(request.postDataJSON().code_verifier).toBeTruthy();verifierExchanged=true;
      await route.fulfill({json:{access_token:jwt,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email,created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}}}});return;
    }
    if(url.pathname.endsWith('/user')){
      expect(request.method()).toBe('PUT');expect(request.postDataJSON().password).toBe('another-long-demo-passphrase');passwordUpdated=true;
      await route.fulfill({json:{id,aud:'authenticated',role:'authenticated',email,created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}}});return;
    }
    if(url.pathname.endsWith('/signup')){
      expect(request.method()).toBe('POST');
      const body=request.postDataJSON();expect(body.email).toBe(email);expect(body.password).toBe('a-long-demo-passphrase');
      expect(body.code_challenge).toBeTruthy();expect(body.code_challenge_method).toBe('s256');
      expect(url.searchParams.get('redirect_to')).toContain('auth=confirmed');
      signup=true;await route.fulfill({json:{id,aud:'authenticated',role:'authenticated',email,created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}}});return;
    }
    if(url.pathname.endsWith('/recover')){
      expect(request.postDataJSON().email).toBe(email);recoveryRedirect=url.searchParams.get('redirect_to')??'';expect(recoveryRedirect).toContain('auth=recovery');
      recovery=true;await route.fulfill({status:200,json:{}});return;
    }
    await route.fulfill({status:500,json:{message:'Unexpected auth request'}});
  });
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/public-config'))return route.fulfill({json:{ok:true,data:{supabaseUrl:'https://auth.test.invalid',supabaseAnonKey:'fixture-key'}}});
    if(path==='/api/projects')return route.fulfill({json:{ok:true,data:{projects:[]}}});
    return route.fulfill({status:404,json:{ok:false,error:{code:'NOT_FOUND'}}});
  });
  await page.goto('/qa-studio.html');await page.getByText('Save or resume a project',{exact:true}).click();
  await page.locator('#account-email').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('a-long-demo-passphrase');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('If email verification is enabled');
  expect(signup).toBe(true);
  const verifierKeys=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.endsWith('-code-verifier')));
  expect(verifierKeys.length).toBeGreaterThan(0);
  const verifier=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}') as {value?:string;expiresAt?:number},verifierKeys[0]!);
  expect(verifier.value).toBeTruthy();expect(verifier.expiresAt).toBeGreaterThan(Date.now());expect(verifier.expiresAt!-Date.now()).toBeLessThanOrEqual(24*60*60*1000);
  expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.endsWith('-auth-token')))).toBe(false);
  await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('If email delivery is enabled and an account matches');
  expect(recovery).toBe(true);
  const callback=new URL(recoveryRedirect);callback.searchParams.set('code','fixture-auth-code');
  expect(callback.searchParams.get('auth')).toBe('recovery');
  await page.goto(callback.href);
  await expect(page.locator('#account-recovery')).toBeVisible();expect(verifierExchanged).toBe(true);
  await expect(page.locator('#recovery-email')).toHaveValue(email);
  await page.locator('#recovery-password').fill('another-long-demo-passphrase');
  await page.locator('#recovery-confirm').fill('different-long-demo-passphrase');
  await page.getByRole('button',{name:'Set new password',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('new passwords do not match');expect(passwordUpdated).toBe(false);
  await page.locator('#recovery-confirm').fill('another-long-demo-passphrase');
  await page.getByRole('button',{name:'Set new password',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('Select a project or save this draft as new');
  expect(passwordUpdated).toBe(true);
});

test('account fixture saves, resumes and reports concurrent edit conflicts',async({page})=>{
  // Controlled HTTP/Auth responses. This proves UI behavior, not Supabase login.
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const user = {id,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}};
  const jwt = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.fixture`;
  await page.route('https://auth.test.invalid/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if(path.endsWith('/token')) await route.fulfill({json:{access_token:jwt,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user}});
    else await route.fulfill({status:200,json:{}});
  });
  let saved: {version:number;content:unknown;created_at:string}|null = null, conflict = false, rendered=false, approved=false;
  let quoted=false,verified=false,productionState='',maliciousDownload=false;
  const previewId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  await page.route('**/api/**',async route=>{
    const request=route.request(), path=new URL(request.url()).pathname;
    if(path.endsWith('/public-config')) { await route.fulfill({json:{ok:true,data:{supabaseUrl:'https://auth.test.invalid',supabaseAnonKey:'fixture-key'}}}); return; }
    expect(request.headers().authorization).toBe(`Bearer ${jwt}`);
    if(path.endsWith('/order')){
      await route.fulfill({json:{ok:true,data:{project:{id,title:'Fixture',state:productionState==='completed'?'delivered':productionState?'producing':verified?'paid':quoted?'quoted':'design_approved'},
        quote:quoted?{id:'fixture-quote',tier:'static',slide_count:4,quote_amount:100,quote_amount_paisa:10000,expires_at:new Date(Date.now()+3600000).toISOString(),status:verified?'paid':'active',not_expired:true}:null,
        payment:verified?{status:'verified',provider:'mock_sandbox',currency:'BDT'}:null,
        production:productionState?{id:'fixture-production',status:productionState,progress_stage:productionState==='completed'?'Delivered':'Generating deck',error_code:null,attempts:1}:null,
        can_produce:verified&&!productionState,download_available:productionState==='completed',
        commerce:{provider:null,live_checkout_available:false,sandbox_available:true,unavailable_reason:'PAYMENT_PROVIDER_NOT_CONFIGURED'}}}});return;
    }
    if(path.endsWith('/motion')){expect(request.postDataJSON()).toEqual({motion_tier:'static',transition_id:null,intensity:null});await route.fulfill({json:{ok:true,data:{}}});return;}
    if(path.endsWith('/quote')){expect(request.postDataJSON()).toEqual({});quoted=true;await route.fulfill({status:201,json:{ok:true,data:{}}});return;}
    if(path.endsWith('/produce')){expect(request.postDataJSON().idempotency_key).toBeTruthy();productionState='queued';await route.fulfill({status:202,json:{ok:true,data:{}}});return;}
    if(path.endsWith('/download')){await route.fulfill({json:{ok:true,data:{download_url:`https://${maliciousDownload?'attacker.test.invalid':'auth.test.invalid'}/storage/v1/object/sign/private-presentations/fixture.pptx?token=fixture`,filename:'fixture.pptx',expires_in_seconds:900}}});return;}
    if(path.endsWith('/previews')) {
      if(request.method()==='POST') {expect(request.postDataJSON().content_version).toBe(1);rendered=true;await route.fulfill({status:202,json:{ok:true,data:{job:{id:previewId}}}});}
      else await route.fulfill({json:{ok:true,data:{preview:rendered?{job_id:previewId,status:'completed',content_version:1,manifest_sha256:'a'.repeat(64),render_manifest:{renderer:'TEST DOUBLE'}}:null,approval:approved?{preview_job_id:previewId}:null,
        pages:rendered?Array.from({length:4},()=>({url:'https://storage.test.invalid/slide.png'})):[]}}});
      return;
    }
    if(path.endsWith('/preview-revision')){await route.fulfill({json:{ok:true,data:{project:{id,state:'preview_revision_requested'}}}});return;}
    if(path.endsWith('/approve-preview')){expect(request.postDataJSON()).toEqual({preview_job_id:previewId,content_version:1,manifest_sha256:'a'.repeat(64),confirmed:true});approved=true;await route.fulfill({status:201,json:{ok:true,data:{approval:{preview_job_id:previewId}}}});return;}
    if(path==='/api/projects') {
      if(request.method()==='POST') await route.fulfill({json:{ok:true,data:{project:{id,title:'Fixture',state:'draft'}}}});
      else await route.fulfill({json:{ok:true,data:{projects:[{id,title:'Fixture',state:'draft'}]}}});
    } else if(request.method()==='PUT') {
      if(conflict) await route.fulfill({status:409,json:{ok:false,error:{code:'CONTENT_VERSION_CONFLICT'}}});
      else { const body=request.postDataJSON(); expect(body.expected_version).toBe(0); saved={version:1,content:body.content,created_at:new Date().toISOString()}; await route.fulfill({json:{ok:true,data:{draft:saved}}}); }
    } else await route.fulfill({json:{ok:true,data:{draft:saved}}});
  });
  await page.route('https://storage.test.invalid/slide.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf0sAAAAASUVORK5CYII=','base64')}));
  await draft(page);
  await page.getByText('Save or resume a project',{exact:true}).click();
  await page.locator('#account-email').fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('Signed in as');
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Save as new project',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('Saved version 1');
  await expect(page.getByRole('button',{name:'Load selected project',exact:true})).toBeDisabled();
  await page.getByLabel('Replace the current local draft when loading a saved project.').check();
  await page.getByRole('button',{name:'Load selected project',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('Loaded version 1');
  await expect(page.getByRole('button',{name:'Render saved slides',exact:true})).toBeDisabled();
  await page.getByLabel('I understand rendering consumes').check();
  await page.getByRole('button',{name:'Render saved slides',exact:true}).click();
  await expect(page.locator('#preview-images img')).toHaveCount(4);
  await expect(page.locator('#preview-status')).toContainText('TEST DOUBLE');
  await expect(page.getByLabel('I understand rendering consumes')).not.toBeChecked();
  await page.getByRole('button',{name:'Edit a new revision',exact:true}).click();
  await expect(page.locator('#preview-status')).toContainText('Revision opened');
  conflict=true;
  await page.getByRole('button',{name:'Save current project',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('Another edit was saved first');
  await expect(page.locator('#slide-title')).toHaveText('Test slide 1');
  await page.getByLabel('I understand rendering consumes').check();
  await page.getByRole('button',{name:'Render saved slides',exact:true}).click();
  await page.locator('#preview-images img').last().scrollIntoViewIfNeeded();
  await expect(page.getByLabel('I reviewed every rendered slide')).toBeEnabled();
  await expect(page.getByRole('button',{name:'Approve rendered design',exact:true})).toBeDisabled();
  await page.getByLabel('I reviewed every rendered slide').check();
  await page.getByRole('button',{name:'Approve rendered design',exact:true}).click();
  await expect(page.locator('#project-status')).toContainText('approval of the rendered design has been recorded');
  await expect(page.locator('#preview-status')).toContainText('Design approved for content version 1');
  await expect(page.getByRole('button',{name:'Edit a new revision',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Checkout unavailable',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Get Static quote',exact:true}).click();
  await expect(page.locator('#quote-summary')).toContainText('100.00');
  await expect(page.locator('#quote-summary')).toContainText('4 approved slides');
  await expect(page.getByRole('button',{name:'Get Static quote',exact:true})).toBeDisabled();
  await page.locator('#order-panel').scrollIntoViewIfNeeded();
  await page.screenshot({path:'../artifacts/studio-order-quote-fixture.png'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.setViewportSize({width:1280,height:720});
  await expect(page.getByRole('button',{name:'Produce verified deck',exact:true})).toBeDisabled();
  // This is a controlled server response, not a customer-side pay-success UI.
  verified=true;
  await page.getByRole('button',{name:'Refresh order status',exact:true}).click();
  await expect(page.locator('#order-status')).toContainText('no real payment was collected');
  await page.getByRole('button',{name:'Produce verified deck',exact:true}).click();
  await expect(page.locator('#order-status')).toContainText('Production: queued');
  await expect(page.getByRole('button',{name:'Produce verified deck',exact:true})).toBeDisabled();
  productionState='completed';
  await page.getByRole('button',{name:'Refresh order status',exact:true}).click();
  await page.getByRole('button',{name:'Prepare private download',exact:true}).click();
  await expect(page.locator('#order-download-link')).toBeVisible();
  await expect(page.locator('#order-download-link')).toHaveAttribute('href',/https:\/\/auth.test.invalid\/storage\/v1\/object\/sign\/private-presentations\//);
  maliciousDownload=true;
  await page.getByRole('button',{name:'Prepare private download',exact:true}).click();
  await expect(page.locator('#order-download-link')).toBeHidden();
  await expect(page.locator('#project-status')).toContainText('download link could not be verified');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save current project',exact:true})).toBeDisabled();
});
