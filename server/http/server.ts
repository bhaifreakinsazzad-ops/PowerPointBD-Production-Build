import { createApp } from './app.ts';
import { env } from './env.ts';
import { createReleaseHost } from './release-host.ts';
import path from 'node:path';

const api=createApp();
const app = env.NODE_ENV==='production'?createReleaseHost(api,path.join(env.repoRoot,'public')):api;
app.listen(env.PORT, env.HOST, () => {
  console.log(`AI Presentation Platform API listening on http://${env.HOST}:${env.PORT}`);
  console.log('NO-GO for paid production — see docs/STATUS.md for what is genuinely verified.');
});
