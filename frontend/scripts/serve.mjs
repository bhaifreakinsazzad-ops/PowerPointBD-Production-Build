import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
http.createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.startsWith('/api/')){
    // Fixed loopback target, no caller-controlled destination or credential logs.
    const upstream=http.request({hostname:'127.0.0.1',port:8787,path:req.url.slice(4),method:req.method,
      headers:{...req.headers,host:'127.0.0.1:8787'},timeout:20000},response=>{
      res.writeHead(response.statusCode||502,response.headers);response.pipe(res);
    });
    upstream.on('timeout',()=>upstream.destroy());
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:{code:'PROJECT_API_UNAVAILABLE'}}));});
    req.on('aborted',()=>upstream.destroy());req.pipe(upstream);return;
  }
  let file=path.resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if((await stat(file)).isDirectory())file=path.join(file,'index.html');const body=await readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);
}catch{res.writeHead(404).end('Not found');}}).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('Prototype server listening on port '+(process.env.PORT||3000)));
process.on('SIGTERM',()=>process.exit(0));
process.on('SIGINT',()=>process.exit(0));
if(process.stdin.isTTY===false){process.stdin.resume();process.stdin.on('end',()=>process.exit(0));}
