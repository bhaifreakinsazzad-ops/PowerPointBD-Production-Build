import express from 'express';
import type { Express } from 'express';

/** One origin for the studio and /api; never serve the repository directory. */
export function createReleaseHost(api:Express,publicRoot:string){
  const host=express();host.disable('x-powered-by');
  host.use('/api',api);
  host.use(express.static(publicRoot,{dotfiles:'deny',index:'index.html',fallthrough:true,
    setHeaders(res,file){
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('Cache-Control',file.endsWith('.html')||file.endsWith('sw.js')?'no-cache':'public, max-age=3600');
      if(file.endsWith('sw.js'))res.setHeader('Service-Worker-Allowed','/');
    }}));
  host.use((_req,res)=>res.status(404).json({ok:false,error:{code:'NOT_FOUND',message:'No such resource.'}}));
  return host;
}
