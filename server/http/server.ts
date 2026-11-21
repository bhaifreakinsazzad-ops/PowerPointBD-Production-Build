import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { createReleaseHost } from './release-host.ts';

const releasePublic = path.join(env.repoRoot, 'public');
const frontendDir = path.join(env.repoRoot, 'frontend');
const frontendDist = path.join(frontendDir, 'dist');

if (!existsSync(path.join(releasePublic, 'index.html')) && !existsSync(path.join(frontendDist, 'index.html'))) {
  execFileSync(process.execPath, ['scripts/build.mjs'], {
    cwd: frontendDir,
    stdio: 'inherit',
  });
}

const api = createApp();
const staticRoot = existsSync(path.join(releasePublic, 'index.html')) ? releasePublic : frontendDist;
const app = createReleaseHost(api, staticRoot);

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`PowerPointBD listening on http://${env.HOST}:${env.PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
