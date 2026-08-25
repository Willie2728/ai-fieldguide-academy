'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

let server;
let baseUrl;
let runtimeDir;

test.before(async () => {
  runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fieldguide-test-'));
  process.env.RUNTIME_DATA_DIR = runtimeDir;
  delete process.env.OPENAI_API_KEY;
  process.env.AI_PROVIDER = 'openai';
  const { createServer } = require('../server');
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  await fs.rm(runtimeDir, { recursive: true, force: true });
});

test('status reports the provider without exposing a secret', async () => {
  const response = await fetch(`${baseUrl}/api/status`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.provider, 'openai');
  assert.equal(body.guideReady, false);
  assert.equal(JSON.stringify(body).includes('API_KEY'), false);
});

test('home page and course data are served', async () => {
  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /AI FieldGuide Academy/);
  const course = await fetch(`${baseUrl}/data/course.json`);
  const data = await course.json();
  assert.equal(data.modules.length, 10);
  assert.equal(data.prompts.length, 20);
  assert.equal(data.reasons.length, 10);
});

test('invalid lead is rejected', async () => {
  const response = await fetch(`${baseUrl}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'wrong', consent: true }) });
  assert.equal(response.status, 400);
});

test('valid lead is stored without returning PII', async () => {
  const response = await fetch(`${baseUrl}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Learner', email: 'learner@example.com', consent: true, source: 'test' }) });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(JSON.stringify(body).includes('learner@example.com'), false);
  const saved = await fs.readFile(path.join(runtimeDir, 'leads.jsonl'), 'utf8');
  assert.match(saved, /learner@example.com/);
});

test('chat fails safely when the server key is absent', async () => {
  const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain the P.R.O. method.' }] }) });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /not configured/i);
});

test('checkout rejects unknown tiers and explains unconfigured links', async () => {
  const unknown = await fetch(`${baseUrl}/api/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'fake' }) });
  assert.equal(unknown.status, 400);
  const missing = await fetch(`${baseUrl}/api/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'pro' }) });
  assert.equal(missing.status, 503);
});
