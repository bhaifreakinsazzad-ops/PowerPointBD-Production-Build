const CACHE='powerpointbd-studio-__CACHE_VERSION__';
const SHELL=__PRECACHE_FILES__;
const ALLOWED=new Set(SHELL.map(file=>new URL(file,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>(key.startsWith('powerpointbd-studio-')||key.startsWith('presentation-demo-'))&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Never intercept API, signed links, provider calls, account callbacks or
  // arbitrary user URLs. Only this exact build's public shell is cacheable.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||!ALLOWED.has(url.pathname))return;
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))??fetch(event.request)));
});
