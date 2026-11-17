import { createProjectClient } from './project-client.ts';
import type { PresentationContent } from '../../../shared/presentation.ts';
import { mountOrderPanel } from './order-ui.ts';

export function mountProjects(options: {
  getDraft(): PresentationContent | undefined; setDraft(content: PresentationContent): void;
  setBusy(busy: boolean): void; isWorking(): boolean;
  client?: ReturnType<typeof createProjectClient>;
}) {
  const client = options.client ?? createProjectClient();
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const button = (id: string) => el<HTMLButtonElement>(id);
  const list = el<HTMLSelectElement>('project-list');
  let signedIn = false, busy = false, active: string | undefined, version = 0;
  let recoveryReady=false;
  let savedFingerprint='',previewKey:string|undefined;
  let previewState='';
  let snapshot:{jobId:string;version:number;hash:string}|undefined,readyImages=0,totalImages=0,approved=false;
  function clearPreview(){previewState='';previewKey=undefined;snapshot=undefined;readyImages=0;totalImages=0;approved=false;el<HTMLInputElement>('approve-consent').checked=false;el<HTMLInputElement>('preview-consent').checked=false;el('preview-images').replaceChildren();el('preview-status').textContent='Save or load a project to request actual slide-image previews.';orderUi.reset();}
  function status(message: string) { el('project-status').textContent = message; }
  function controls() {
    const locked = busy || options.isWorking();
    button('account-sign-in').disabled = locked || signedIn;
    button('account-sign-out').hidden = !signedIn;
    button('account-sign-out').disabled = locked;
    button('account-create').disabled = locked || signedIn;
    button('account-forgot').disabled = locked || signedIn || !el<HTMLInputElement>('account-email').value.trim();
    button('recovery-submit').disabled = locked || !recoveryReady;
    button('recovery-cancel').disabled = locked;
    button('project-refresh').disabled = locked || !signedIn;
    button('project-new').disabled = locked || !signedIn || !options.getDraft();
    button('project-save').disabled = locked || !signedIn || !options.getDraft() || !active || approved;
    button('project-load').disabled = locked || !signedIn || !list.value
      || (!!options.getDraft() && !el<HTMLInputElement>('replace-draft').checked);
    list.disabled = locked || !signedIn;
    const saved=!!options.getDraft()&&JSON.stringify(options.getDraft())===savedFingerprint;
    button('preview-request').disabled=locked||!signedIn||!active||!saved||!version
      ||!el<HTMLInputElement>('preview-consent').checked||['queued','running','failed','completed'].includes(previewState);
    button('preview-refresh').disabled=locked||!signedIn||!active;
    button('preview-revise').disabled=locked||!signedIn||!active||previewState!=='completed'||approved;
    const approvable=!locked&&signedIn&&!!active&&saved&&previewState==='completed'&&!approved
      &&snapshot?.version===version&&totalImages>0&&readyImages===totalImages&&/^[0-9a-f]{64}$/.test(snapshot.hash);
    el<HTMLInputElement>('approve-consent').disabled=!approvable;
    button('preview-approve').disabled=!approvable||!el<HTMLInputElement>('approve-consent').checked;
    orderUi?.update();
  }
  async function refresh() {
    const projects = await client.list();
    list.replaceChildren(new Option('Choose a saved project',''));
    projects.forEach((p) => list.add(new Option(`${p.title} · ${p.state}`,p.id)));
    if (active && projects.some((p) => p.id === active)) list.value = active;
  }
  async function run(action: () => Promise<void>) {
    if (busy || options.isWorking()) return;
    busy = true; options.setBusy(true); controls();
    try { await action(); }
    catch (error) {
      const code = error instanceof Error ? error.message : '';
      if(code==='PROJECT_RECOVERY_SESSION_INVALID')clearAuthCallback();
      const messages: Record<string,string> = {
        CONTENT_VERSION_CONFLICT:'Another edit was saved first. Download your local draft, then reload the project before retrying.',
        CONTENT_DRAFT_LOCKED:'This project has entered design or checkout. Its content needs the revision workflow.',
        PROJECT_SIGN_IN_FAILED:'Sign-in failed. Check your email and password, and confirm your account is active.',
        PROJECT_SIGN_UP_FAILED:'The account could not be created. Check the email and password, then try again.',
        PROJECT_RECOVERY_REQUEST_FAILED:'Password recovery could not be requested. Check the email and try again.',
        PROJECT_RECOVERY_SESSION_INVALID:'This recovery link is invalid or expired. Request a new password reset email.',
        PROJECT_PASSWORD_UPDATE_FAILED:'The password could not be changed. Request a new reset link and try again.',
        PROJECT_AUTH_STORAGE_UNAVAILABLE:'This browser blocks the temporary secure state needed for email verification and recovery. Enable site storage and try again.',
        PROJECT_SIGN_IN_REQUIRED:'Your session has ended. Sign out and sign in again. Your local draft is unchanged.',
        PROJECT_API_UNAVAILABLE:'The project API is unavailable. Keep editing locally or download your draft.',
        PREVIEW_ALREADY_PENDING:'A preview is already pending. Refresh preview status to resume it.',
        PREVIEW_PROJECT_LIMIT:'Your two included preview project slots have been consumed.',
        PREVIEW_REVISION_LIMIT:'This project has consumed its two included revision rounds.',
        PREVIEW_SNAPSHOT_MISMATCH:'The preview or saved content changed. Reload the current slide images before approval.',
        PREVIEW_NOT_APPROVABLE:'These previews cannot be approved. Refresh their status and check every slide image.',
        QUOTE_RESPONSE_INVALID:'The server returned an invalid quote. Refresh the order before continuing.',
        PAYMENT_PROVIDER_NOT_CONFIGURED:'Checkout is unavailable until a real payment provider is configured.',
        DOWNLOAD_URL_INVALID:'The private download link could not be verified. Refresh order status and try again.',
      };
      status(messages[code] ?? 'The project request failed. Your local draft is unchanged. Download it before retrying.');
    } finally { busy = false; options.setBusy(false); controls(); }
  }
  function clearAuthCallback() {
    const url=new URL(window.location.href);
    const hasCallback=url.searchParams.has('auth')||url.searchParams.has('code')||url.hash.includes('access_token=');
    if(!hasCallback)return;
    url.searchParams.delete('auth');url.searchParams.delete('code');url.hash='';
    window.history.replaceState(null,'',url.pathname+url.search);
  }
  async function establishSession(email:string) {
    el<HTMLInputElement>('account-password').value='';
    signedIn=true;el<HTMLFormElement>('account-form').hidden=false;el<HTMLFormElement>('account-recovery').hidden=true;recoveryReady=false;
    clearAuthCallback();status(`Signed in as ${email}. Loading your projects…`);await refresh();
    status(`Signed in as ${email}. Select a project or save this draft as new.`);
  }
  const orderUi=mountOrderPanel({client,getProjectId:()=>active,isApproved:()=>approved,
    isWorking:()=>busy||options.isWorking(),run});
  el<HTMLFormElement>('account-form').addEventListener('submit',(event) => {
    event.preventDefault();
    void run(async () => {
      const email = await client.signIn(el<HTMLInputElement>('account-email').value.trim(),el<HTMLInputElement>('account-password').value);
      await establishSession(email);
    });
  });
  button('account-create').addEventListener('click',()=>void run(async()=>{
    const email=el<HTMLInputElement>('account-email').value.trim(),password=el<HTMLInputElement>('account-password').value;
    if(!el<HTMLInputElement>('account-email').reportValidity())return;
    if(password.length<12){status('Use a unique passphrase with at least 12 characters to create an account.');return;}
    const result=await client.signUp(email,password);el<HTMLInputElement>('account-password').value='';
    if(result.signedIn)await establishSession(result.email);
    else status('Account request submitted. If email verification is enabled, check your inbox before signing in.');
  }));
  el<HTMLInputElement>('account-email').addEventListener('input',controls);
  button('account-forgot').addEventListener('click',()=>void run(async()=>{
    const email=el<HTMLInputElement>('account-email').value.trim();
    if(!el<HTMLInputElement>('account-email').reportValidity())return;
    await client.requestPasswordReset(email);
    status('If email delivery is enabled and an account matches, password recovery instructions will be sent.');
  }));
  el<HTMLFormElement>('account-recovery').addEventListener('submit',event=>{
    event.preventDefault();void run(async()=>{
      const password=el<HTMLInputElement>('recovery-password').value,confirmation=el<HTMLInputElement>('recovery-confirm').value;
      if(password.length<12){status('Use a unique passphrase with at least 12 characters.');return;}
      if(password!==confirmation){status('The new passwords do not match.');return;}
      const email=await client.completeRecovery(password);
      el<HTMLInputElement>('recovery-password').value='';el<HTMLInputElement>('recovery-confirm').value='';
      await establishSession(email);
    });
  });
  button('recovery-cancel').addEventListener('click',()=>{
    recoveryReady=false;el<HTMLFormElement>('account-recovery').hidden=true;el<HTMLFormElement>('account-form').hidden=false;
    el<HTMLInputElement>('recovery-password').value='';el<HTMLInputElement>('recovery-confirm').value='';clearAuthCallback();
    status('Password recovery cancelled. Sign in or request another reset email.');controls();
  });
  button('account-sign-out').addEventListener('click',() => void run(async () => {
    try { await client.signOut(); }
    finally {
      signedIn = false; active = undefined; version = 0; list.replaceChildren(new Option('Sign in to load projects',''));
      savedFingerprint='';clearPreview();
      status('Signed out of this page. The local draft remains available to download.');
    }
  }));
  button('project-refresh').addEventListener('click',() => void run(async () => { await refresh(); status('Project list refreshed.'); }));
  button('project-load').addEventListener('click',() => {
    if (button('project-load').disabled) return;
    void run(async () => {
      const id = list.value, saved = await client.load(id);
      if (!saved) { status('This project has no saved text draft yet.'); return; }
      options.setDraft(saved.content); active = id; version = saved.version;
      savedFingerprint=JSON.stringify(saved.content);clearPreview();
      el<HTMLInputElement>('replace-draft').checked = false;
      status(`Loaded version ${version}. Text review is separate from design approval.`);
      await showPreview();
    });
  });
  async function save(asNew: boolean) {
    const content = options.getDraft(); if (!content) return;
    if (asNew) { const project = await client.create(content); active = project.id; version = 0; savedFingerprint='';clearPreview(); }
    if (!active) return;
    const saved = await client.save(active,version,content);
    if(version!==saved.version)clearPreview();version = saved.version;savedFingerprint=JSON.stringify(saved.content);
    status(`Saved version ${version}. No preview allowance, approval or payment was consumed.`);
    await refresh();
  }
  button('project-new').addEventListener('click',() => void run(() => save(true)));
  button('project-save').addEventListener('click',() => void run(() => save(false)));
  list.addEventListener('change',controls); el('replace-draft').addEventListener('change',controls);
  el('preview-consent').addEventListener('change',controls);
  el('approve-consent').addEventListener('change',controls);
  async function showPreview(){
    if(!active)return;
    const result=await client.preview(active);const preview=result.preview;
    el('preview-images').replaceChildren();snapshot=undefined;readyImages=0;totalImages=0;approved=false;el<HTMLInputElement>('approve-consent').checked=false;
    if(!preview){previewState='';orderUi.reset();el('preview-status').textContent='No preview request has been made for this project.';return;}
    previewState=preview.status;
    const messages:Record<string,string>={queued:'Queued for rendering. Allowance is consumed when the worker starts.',running:'Rendering the saved PowerPoint. Your allowance has been counted.',failed:'Rendering failed; the same job will retry automatically without another quota charge.',quarantined:'Rendering stopped. Check the recorded reason before requesting another round.'};
    el('preview-status').textContent=messages[preview.status]??`Preview ${preview.status}.`;
    if(preview.status==='quarantined'){previewKey=undefined;el('preview-status').textContent+=` Reason: ${String(preview.error_code??'PREVIEW_RENDER_FAILED')}.`;}
    if(preview.status==='completed'){
      snapshot={jobId:preview.job_id,version:preview.content_version,hash:preview.manifest_sha256??''};
      const batch=snapshot;totalImages=(result.pages??[]).length;
      if(totalImages!==(options.getDraft()?.slides.length??0))totalImages=0;
      approved=result.approval?.preview_job_id===preview.job_id;
      el('preview-status').textContent=`Rendered content version ${preview.content_version} with ${preview.render_manifest?.renderer??'the configured renderer'}. Desktop PowerPoint compatibility is unverified. These images are not yet approved for production.`;
      if(approved)el('preview-status').textContent=`Design approved for content version ${preview.content_version}. Review your quote and production status below.`;
      for(const [index,page] of (result.pages??[]).entries()){
        const image=document.createElement('img');image.src=page.url;image.alt=`Rendered slide ${index+1}, content version ${preview.content_version}`;
        image.loading='lazy';image.width=1280;image.height=720;
        image.addEventListener('load',()=>{if(snapshot===batch){readyImages++;controls();}});
        image.addEventListener('error',()=>{el('preview-status').textContent='A private preview image could not load. Refresh preview status to renew its link.';});
        const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=`Slide ${index+1}`;
        figure.append(image,caption);el('preview-images').append(figure);
      }
    }
    if(approved)await orderUi.refresh();else orderUi.reset();
  }
  button('preview-request').addEventListener('click',()=>{
    if(button('preview-request').disabled)return;
    void run(async()=>{if(!active)return;previewKey??=crypto.randomUUID();await client.requestPreview(active,version,previewKey);el<HTMLInputElement>('preview-consent').checked=false;await showPreview();});
  });
  button('preview-refresh').addEventListener('click',()=>void run(showPreview));
  button('preview-revise').addEventListener('click',()=>void run(async()=>{
    if(!active)return;await client.revise(active);clearPreview();
    el('preview-status').textContent='Revision opened. Edit and save your draft, then request rendering. The revision allowance is consumed when rendering starts.';
  }));
  button('preview-approve').addEventListener('click',()=>{
    if(button('preview-approve').disabled||!snapshot)return;
    const choice=snapshot;
    void run(async()=>{if(!active)return;await client.approve(active,choice.jobId,choice.version,choice.hash);await showPreview();status('Your approval of the rendered design has been recorded.');});
  });
  controls();
  if(new URLSearchParams(window.location.search).get('auth')==='recovery'){
    el<HTMLDetailsElement>('project-panel').open=true;
    status('Checking your password recovery link…');
    queueMicrotask(()=>void run(async()=>{
      const email=await client.prepareRecovery();
      if(!email)throw new Error('PROJECT_RECOVERY_SESSION_INVALID');
      el<HTMLInputElement>('recovery-email').value=email;recoveryReady=true;
      el<HTMLFormElement>('account-form').hidden=true;el<HTMLFormElement>('account-recovery').hidden=false;
      status('Choose a new password to finish recovering your PowerPointBD account.');
    }));
  }
  return { update: controls, detach() { active = undefined; version = 0; savedFingerprint='';clearPreview();controls(); } };
}
