// Explicit in-memory model tests. No gateway, storage, database or PowerPoint claims.
import assert from 'node:assert/strict';
import {
  ProductionFoundationServer, AdminPricingUpdateSchema, runProductionFoundationTests,
} from './backend.ts';

const baseline = runProductionFoundationTests();
const results = [...baseline.results];
const projectId = '10000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
function fixture() {
  const server = new ProductionFoundationServer();
  return { server, user: server.users.get(userId) };
}
function test(name, run) { run(); results.push(`PASS [regression]: ${name}`); }

test('all unverified motion candidates disabled by default', () => {
  const { server, user } = fixture();
  assert.equal([...server.motionLibrary.values()].filter(e => e.enabled).length, 0);
  for (const transition of ['fade', 'wipe', 'push', 'zoom']) {
    assert.equal(server.postProjectMotion(user, projectId, {
      motion_tier: 'smooth', transition_id: transition, intensity: 'standard',
    }).status, 400);
  }
});
test('seeded Smooth spec cannot bypass disabled candidates by quoting directly', () => {
  const { server, user } = fixture();
  assert.equal(server.postProjectQuote(user, projectId, {}).status, 409);
  assert.equal(server.quotes.size, 0);
});
test('Static selection updates project requested tier and spec together', () => {
  const { server, user } = fixture();
  const response = server.postProjectMotion(user, projectId, {
    motion_tier: 'static', transition_id: null, intensity: null,
  });
  assert.equal(response.status, 200);
  assert.equal(server.projects.get(projectId).motion_tier_requested, 'static');
  assert.equal(response.body.data.design_spec.spec_json.motion_tier, 'static');
});
test('draft cannot obtain a quote or lock a design', () => {
  const { server, user } = fixture();
  server.projects.get(projectId).state = 'draft';
  assert.equal(server.postProjectQuote(user, projectId, {}).status, 409);
  assert.equal(server.quotes.size, 0);
  assert.equal([...server.designSpecs.values()][0].is_locked, false);
});
test('re-quote replaces frozen lifecycle record without altering monetary snapshot', () => {
  const { server, user } = fixture();
  server.postProjectMotion(user, projectId, { motion_tier:'static', transition_id:null, intensity:null });
  const first = server.postProjectQuote(user, projectId, {}).body.data.quote;
  const old = server.quotes.get(first.id);
  const snapshot = JSON.stringify(old.quote_breakdown);
  const second = server.postProjectQuote(user, projectId, {});
  assert.equal(second.status, 201);
  assert.equal(server.quotes.get(first.id).status, 'superseded');
  assert.equal(JSON.stringify(server.quotes.get(first.id).quote_breakdown), snapshot);
  assert.equal(old.status, 'active'); // Previously handed-out immutable object stays untouched.
  assert.ok(Object.isFrozen(server.quotes.get(first.id)));
});
test('TTL rejects negative, zero, noninteger, nonfinite and over-limit values', () => {
  const body = { base_rate_bdt:25, smooth_rate_bdt:11, change_reason:'Regression check' };
  for (const value of [-99, 0, 1.5, Infinity, NaN, 169, '24']) {
    assert.equal(AdminPricingUpdateSchema.safeParse({...body, quote_ttl_hours:value}).success, false);
  }
  for (const value of [1, 24, 48, 168]) {
    assert.equal(AdminPricingUpdateSchema.safeParse({...body, quote_ttl_hours:value}).success, true);
  }
});
test('optional Cinematic rates and flags require actual bounded types', () => {
  const body = { base_rate_bdt:25, smooth_rate_bdt:11, change_reason:'Regression check' };
  for (const value of [-1, 0, 0.5, 2001, NaN, '30']) {
    assert.equal(AdminPricingUpdateSchema.safeParse({...body, cinematic_rate_bdt:value}).success, false);
  }
  assert.equal(AdminPricingUpdateSchema.safeParse({...body, cinematic_enabled:'false'}).success, false);
});

for (const result of results) console.log(result);
console.log(JSON.stringify({ status:'PASS', tests_passed:results.length,
  scope:'IN_MEMORY_DEMO_ONLY', database:'NOT_RUN', payment_gateway:'NOT_CONNECTED',
  powerpoint_generation:'NOT_CONNECTED', desktop_playback:'UNVERIFIED' }, null, 2));
