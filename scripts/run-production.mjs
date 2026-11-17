const target=process.argv[2]??'api';
if(!['api','worker'].includes(target))throw new Error('Use api or worker as the production entrypoint.');
// Set before loading any application module or environment configuration.
process.env.NODE_ENV='production';
if(target==='api')await import('../server/http/server.js');
else await (await import('../server/http/worker.js')).runWorkerLoop();
