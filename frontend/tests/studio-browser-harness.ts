// Browser-only fixture entry. Never included by the production build.
import { mountStudio } from '../src/studio/controller.ts';
import type { PuterSDK } from '../src/studio/puter-client.ts';
const sdk: PuterSDK = {
  auth: { isSignedIn:()=>true, async signIn(){}, async getUser(){return {username:'Browser test fixture'};} },
  ai: {
    async listModels(){return [{id:'test-fixture-model',provider:'test-fixture',name:'Browser test fixture'}];},
    async chat(messages){
      const request=JSON.parse((messages as {content:string}[])[1]!.content) as {slide_count:number; language:string};
      return {message:{content:JSON.stringify({version:1,title:'Browser test draft',language:request.language,
        slides:Array.from({length:request.slide_count},(_,index)=>({title:`Test slide ${index+1}`,
          bullets:['Browser fixture, not AI-generated content','Verify editing, navigation and 3D interaction'],notes:'Controlled browser test.'}))})}};
    },
  },
};
const notice=document.createElement('p'); notice.textContent='BROWSER TEST FIXTURE · No real AI calls or payments';
notice.style.cssText='position:sticky;top:0;z-index:100;margin:0;padding:8px 20px;background:#573100;color:#fff;font-size:13px'; document.body.prepend(notice);
mountStudio({loadSDK:async()=>sdk});
