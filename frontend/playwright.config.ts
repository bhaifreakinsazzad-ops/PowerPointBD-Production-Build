import { existsSync } from 'node:fs';
import { chromium, defineConfig } from '@playwright/test';

const browserCandidates = [
  process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  (() => {
    try { return chromium.executablePath(); } catch { return undefined; }
  })(),
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = browserCandidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

export default defineConfig({
  testDir: './tests', testMatch: 'studio.browser.spec.ts', workers: 1, retries: 0,
  timeout: 30_000, reporter: 'list', outputDir: '.test-output',
  use: { baseURL: 'http://127.0.0.1:3041', browserName: 'chromium', headless: true,
    launchOptions: { executablePath, args: ['--use-angle=swiftshader','--enable-webgl'] } },
  webServer: { command: 'node scripts/serve.mjs', env: { PORT: '3041' },
    url: 'http://127.0.0.1:3041/qa-studio.html', reuseExistingServer: false, timeout: 20_000 },
});
