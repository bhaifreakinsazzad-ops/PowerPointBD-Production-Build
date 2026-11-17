import { mountStudio } from './controller.ts';
mountStudio();
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    // No forced activation: closing/reopening the app adopts an update without
    // silently reloading an unsaved draft. API/private responses are not cached.
    void navigator.serviceWorker.register('./sw.js').catch(()=>{
      const status=document.getElementById('offline-status');
      if(status){status.hidden=false;status.textContent='Offline app caching is unavailable. Online drafting remains available.';}
    });
  });
}
