import { validatePresentation, type PresentationContent } from '../../../shared/presentation.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SavedDraft { version: number; content: PresentationContent; created_at: string }
export interface Project { id: string; title: string; state: string }
export interface Order {
  project:Project;quote:{id:string;tier:string;slide_count:number;quote_amount:number;quote_amount_paisa:number;expires_at:string;status:string;not_expired:boolean}|null;
  payment:{status:string;provider:string;currency:string}|null;
  production:{id:string;status:string;progress_stage:string;error_code:string|null;attempts:number}|null;
  can_produce:boolean;download_available:boolean;
  commerce:{provider:null;live_checkout_available:false;sandbox_available:boolean;unavailable_reason:string};
}
export function createProjectClient(request: typeof fetch = fetch) {
  let auth: SupabaseClient | undefined;
  let storageOrigin='';
  async function ensureAuth() {
    if (auth) return auth;
    const response = await request('/api/public-config', { signal: AbortSignal.timeout(15000) });
    const config = await response.json();
    if (!response.ok || !config.ok) throw new Error('PROJECT_API_UNAVAILABLE');
    const { createClient } = await import('@supabase/supabase-js');
    storageOrigin=new URL(config.data.supabaseUrl).origin;
    // Keep access/refresh sessions in this page's memory, but preserve Supabase's
    // short-lived PKCE verifier so confirmation and reset links can finish in a
    // newly opened tab. The SDK removes the verifier after it exchanges the code.
    const sessionMemory:Record<string,string>={};
    const verifierMaxAge=24*60*60*1000;
    const authStorage={
      async getItem(key:string){
        if(key.endsWith('-code-verifier')){
          try{
            const raw=window.localStorage.getItem(key);if(!raw)return null;
            const stored=JSON.parse(raw) as {value?:unknown;expiresAt?:unknown};
            if(typeof stored.value!=='string'||typeof stored.expiresAt!=='number'||stored.expiresAt<=Date.now()){
              window.localStorage.removeItem(key);return null;
            }
            return stored.value;
          }catch(error){
            if(error instanceof Error&&error.message==='PROJECT_AUTH_STORAGE_UNAVAILABLE')throw error;
            try{window.localStorage.removeItem(key);}catch{throw new Error('PROJECT_AUTH_STORAGE_UNAVAILABLE');}
            return null;
          }
        }
        return sessionMemory[key]??null;
      },
      async setItem(key:string,value:string){
        if(key.endsWith('-code-verifier')){try{window.localStorage.setItem(key,JSON.stringify({value,expiresAt:Date.now()+verifierMaxAge}));}catch{throw new Error('PROJECT_AUTH_STORAGE_UNAVAILABLE');}}
        else sessionMemory[key]=value;
      },
      async removeItem(key:string){
        if(key.endsWith('-code-verifier')){try{window.localStorage.removeItem(key);}catch{throw new Error('PROJECT_AUTH_STORAGE_UNAVAILABLE');}}
        else delete sessionMemory[key];
      },
    };
    auth = createClient(config.data.supabaseUrl, config.data.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: true, storage: authStorage, storageKey: 'powerpointbd-auth', detectSessionInUrl: true, flowType: 'pkce' },
      global: { fetch: (input, init) => request(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
    return auth;
  }
  function redirectUrl(purpose: 'recovery' | 'confirmed') {
    const url = new URL(window.location.href);
    url.search = ''; url.hash = '';
    url.searchParams.set('auth', purpose);
    return url.href;
  }
  async function call(route: string, body?: unknown, method = 'POST') {
    const token = (await auth?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error('PROJECT_SIGN_IN_REQUIRED');
    const response = await request(`/api${route}`, { method: body === undefined ? 'GET' : method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error?.code ?? 'PROJECT_REQUEST_FAILED');
    return json.data;
  }
  return {
    async signIn(email: string, password: string) {
      const client = await ensureAuth();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new Error('PROJECT_SIGN_IN_FAILED');
      return data.user.email ?? 'Signed in';
    },
    async signUp(email: string, password: string) {
      const client = await ensureAuth();
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl('confirmed') } });
      if (error || !data.user) throw new Error('PROJECT_SIGN_UP_FAILED');
      return { email: data.user.email ?? email, signedIn: !!data.session };
    },
    async requestPasswordReset(email: string) {
      const client = await ensureAuth();
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl('recovery') });
      if (error) throw new Error('PROJECT_RECOVERY_REQUEST_FAILED');
    },
    async prepareRecovery() {
      const client = await ensureAuth();
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) throw new Error('PROJECT_RECOVERY_SESSION_INVALID');
      return data.session.user.email ?? '';
    },
    async completeRecovery(password: string) {
      const client = await ensureAuth();
      const { data: current, error: sessionError } = await client.auth.getSession();
      if (sessionError || !current.session) throw new Error('PROJECT_RECOVERY_SESSION_INVALID');
      const { data, error } = await client.auth.updateUser({ password });
      if (error || !data.user) throw new Error('PROJECT_PASSWORD_UPDATE_FAILED');
      return data.user.email ?? '';
    },
    async signOut() {
      // Local scope preserves sessions on other devices/apps in the shared project.
      const { error } = await auth?.auth.signOut({ scope: 'local' }) ?? {};
      auth?.auth.stopAutoRefresh(); auth = undefined;
      if (error) throw new Error('PROJECT_SIGN_OUT_FAILED');
    },
    async list(): Promise<Project[]> { return (await call('/projects')).projects; },
    async create(content: PresentationContent): Promise<Project> {
      return (await call('/projects', { title: content.title, slide_count: content.slides.length,
        language_mode: content.language, motion_tier_requested: 'static', input_mode: 'paste' })).project;
    },
    async load(id: string): Promise<SavedDraft | null> {
      const draft = (await call(`/projects/${encodeURIComponent(id)}/content`)).draft;
      return draft ? { ...draft, content: validatePresentation(draft.content) } : null;
    },
    async save(id: string, version: number, content: PresentationContent): Promise<SavedDraft> {
      const draft = (await call(`/projects/${encodeURIComponent(id)}/content`, { expected_version: version, content: validatePresentation(content) }, 'PUT')).draft;
      return { ...draft, content: validatePresentation(draft.content) };
    },
    async requestPreview(id:string,version:number,key:string) {
      return call(`/projects/${encodeURIComponent(id)}/previews`,{content_version:version,idempotency_key:key});
    },
    async preview(id:string) {
      return call(`/projects/${encodeURIComponent(id)}/previews`);
    },
    async revise(id:string) {
      return call(`/projects/${encodeURIComponent(id)}/preview-revision`,{});
    },
    async approve(id:string,preview_job_id:string,content_version:number,manifest_sha256:string) {
      return call(`/projects/${encodeURIComponent(id)}/approve-preview`,{preview_job_id,content_version,manifest_sha256,confirmed:true});
    },
    async order(id:string):Promise<Order>{return call(`/projects/${encodeURIComponent(id)}/order`);},
    async quote(id:string,configure:boolean){
      if(configure)await call(`/projects/${encodeURIComponent(id)}/motion`,{motion_tier:'static',transition_id:null,intensity:null});
      return call(`/projects/${encodeURIComponent(id)}/quote`,{});
    },
    async produce(id:string,key:string){return call(`/projects/${encodeURIComponent(id)}/produce`,{idempotency_key:key});},
    async confirmPayment(quoteId:string,paymentMethod:string,reference:string,idempotencyKey:string){
      return call('/checkout/confirm',{quote_id:quoteId,payment_method:paymentMethod,reference,idempotency_key:idempotencyKey});
    },
    async download(id:string):Promise<{url:string;filename:string;expires:number}>{
      const result=await call(`/projects/${encodeURIComponent(id)}/download`);
      const url=new URL(result.download_url,window.location.origin);
      const isSupabase=url.origin===storageOrigin&&url.pathname.startsWith('/storage/v1/object/sign/private-presentations/');
      const isLocal=url.origin===window.location.origin&&url.pathname.startsWith('/api/download/private');
      if((!isSupabase&&!isLocal)||url.username||url.password)throw new Error('DOWNLOAD_URL_INVALID');
      return {url:url.href,filename:String(result.filename),expires:Number(result.expires_in_seconds)};
    },
  };
}
