import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';

test('demo never ships a prefilled fixture credential', async () => {
  const html = await readFile('public/live-demo.html', 'utf8');
  assert.match(html, /id="email" type="email" autocomplete="username"\s*\/>/);
  assert.match(html, /id="password" type="password" autocomplete="current-password"\s*\/>/);
  assert.doesNotMatch(html, /integration-test-[ab]@ai-presentation-platform\.internal/);
});

async function demo(statuses) {
  const html = await readFile('public/live-demo.html', 'utf8');
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace(/^\s*import .*?;\s*$/m, '');
  const window = new Window({ settings: { enableJavaScriptEvaluation: true,
    disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
  window.document.write(html.replace(/<script[\s\S]*?<\/script>/g, ''));
  window.createClient = () => ({});
  const requests = [];
  window.fetch = async (url, init) => {
    requests.push({ url, method: init?.method ?? 'GET' });
    const data = url.endsWith('/produce') ? { job: { id: 'job-1', status: 'queued' } } : { job: statuses.shift() };
    return { ok: true, async json() { return { ok: true, data }; } };
  };
  window.eval(script + "\nstate.projectId='project-1';");
  return { window, requests };
}

test('demo polls an enqueued job and labels placeholder content honestly', async () => {
  const { window, requests } = await demo([null, { id: 'job-1', status: 'completed' }]);
  try {
    await window.document.getElementById('produce-btn').onclick();
    assert.equal(requests.filter((request) => request.method === 'POST').length, 1);
    assert.equal(window.document.getElementById('download-card').classList.contains('hidden'), false);
    assert.match(window.document.getElementById('produce-status').textContent, /placeholder/);
    assert.equal(window.document.getElementById('produce-btn').disabled, false);
  } finally { await window.happyDOM.close(); }
});
test('demo resumes an existing queued job without creating a duplicate', async () => {
  const { window, requests } = await demo([{ id: 'job-1', status: 'queued' }, { id: 'job-1', status: 'completed' }]);
  try {
    await window.document.getElementById('produce-btn').onclick();
    assert.equal(requests.filter((request) => request.method === 'POST').length, 0);
    assert.match(window.document.getElementById('produce-status').textContent, /ready/);
  } finally { await window.happyDOM.close(); }
});
test('demo reports quarantine without exposing a download', async () => {
  const { window } = await demo([{ id: 'job-1', status: 'queued' }, { id: 'job-1', status: 'quarantined' }]);
  try {
    await window.document.getElementById('produce-btn').onclick();
    assert.match(window.document.getElementById('produce-status').textContent, /retry limit/);
    assert.equal(window.document.getElementById('download-card').classList.contains('hidden'), true);
    assert.equal(window.document.getElementById('produce-btn').disabled, false);
  } finally { await window.happyDOM.close(); }
});
