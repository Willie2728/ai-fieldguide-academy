'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { getProvider, supportedProviders } = require('./providers');

const ROOT = __dirname;
const COURSE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'course.json'), 'utf8'));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};
const limits = new Map();

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();

function headers(contentType = 'application/json; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'Cache-Control': contentType.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, headers());
  res.end(JSON.stringify(payload));
}

async function readJson(req, maxBytes = 40_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Request is too large.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Invalid JSON.'), { statusCode: 400 }); }
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimit(req, bucket, max, windowMs) {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const current = limits.get(key);
  if (!current || now > current.reset) {
    limits.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > max) throw Object.assign(new Error('Please wait a moment and try again.'), { statusCode: 429 });
}

function sanitizeMessages(input) {
  if (!Array.isArray(input) || input.length < 1) throw Object.assign(new Error('At least one message is required.'), { statusCode: 400 });
  return input.slice(-12).map(message => {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(message?.content || '').trim().slice(0, 4000);
    if (!content) throw Object.assign(new Error('Messages cannot be empty.'), { statusCode: 400 });
    return { role, content };
  });
}

function guideInstructions(pageContext = '') {
  const moduleNames = COURSE.modules.map(module => module.title).join('; ');
  return `You are Willie, the AI Wisdom Guide for AI FieldGuide Academy. You are a warm, practical learning companion available on every course page. Teach concepts clearly, give safe workplace examples, and help learners apply lessons. The curriculum covers: ${moduleNames}. Use the P.R.O. prompt method: Purpose, Relevant context, Output contract. Be vendor-neutral and clearly distinguish ChatGPT, Claude, Claude Code, Claude Cowork, and general AI-agent concepts. Do not promise income, employment, tool accuracy, or business results. Encourage verification, privacy protection, permission boundaries, and human review before consequential actions. Never claim to be human. If asked about a current feature and web search is unavailable, say it may have changed and direct the learner to official documentation. Page context: ${pageContext || 'general academy page'}. Lead with a direct answer, then give a short example or next step.`;
}

async function handleChat(req, res) {
  rateLimit(req, 'chat', 20, 60_000);
  const body = await readJson(req);
  const messages = sanitizeMessages(body.messages);
  const rawSession = String(body.sessionId || clientIp(req)).slice(0, 200);
  const safetyIdentifier = `academy_${crypto.createHash('sha256').update(rawSession).digest('hex').slice(0, 24)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const result = await getProvider().complete({
      messages,
      instructions: guideInstructions(String(body.pageContext || '').slice(0, 400)),
      safetyIdentifier,
      signal: controller.signal
    });
    sendJson(res, 200, { reply: result.text, provider: result.provider, model: result.model });
  } finally { clearTimeout(timeout); }
}

async function handleLead(req, res) {
  rateLimit(req, 'lead', 8, 60_000);
  const body = await readJson(req, 10_000);
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim().slice(0, 100);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { statusCode: 400 });
  if (body.consent !== true) throw Object.assign(new Error('Consent is required.'), { statusCode: 400 });
  const record = { id: crypto.randomUUID(), email, name, source: String(body.source || 'website').slice(0, 80), createdAt: new Date().toISOString() };
  const dataDir = process.env.RUNTIME_DATA_DIR ? path.resolve(process.env.RUNTIME_DATA_DIR) : path.join(ROOT, '.runtime');
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.appendFile(path.join(dataDir, 'leads.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
  if (process.env.LEAD_WEBHOOK_URL) {
    fetch(process.env.LEAD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) }).catch(() => {});
  }
  sendJson(res, 201, { ok: true, message: 'Your AI Workday Starter Kit is reserved.' });
}

async function handleCheckout(req, res) {
  rateLimit(req, 'checkout', 20, 60_000);
  const body = await readJson(req, 5_000);
  const tier = String(body.tier || '').toLowerCase();
  const links = {
    essentials: process.env.CHECKOUT_ESSENTIALS_URL,
    pro: process.env.CHECKOUT_PRO_URL,
    builder: process.env.CHECKOUT_BUILDER_URL,
    teams: process.env.CHECKOUT_TEAMS_URL
  };
  if (!Object.hasOwn(links, tier)) throw Object.assign(new Error('Unknown pricing tier.'), { statusCode: 400 });
  if (!links[tier]) throw Object.assign(new Error('Checkout is ready to connect, but this tier does not have a payment link yet.'), { statusCode: 503 });
  sendJson(res, 200, { url: links[tier] });
}

async function serveStatic(urlPath, req, res) {
  const aliases = {
    '/': '/index.html', '/course': '/course.html', '/app': '/app.html', '/for-teams': '/for-teams.html',
    '/ai-income': '/ai-income.html', '/business-plan': '/business-plan.html', '/brand-lab': '/brand-lab.html'
  };
  const requested = aliases[urlPath] || urlPath;
  const safe = path.resolve(ROOT, `.${requested}`);
  if (!safe.startsWith(ROOT) || safe.includes(`${path.sep}.runtime${path.sep}`) || safe.endsWith(`${path.sep}.env`)) return false;
  try {
    const stat = await fsp.stat(safe);
    if (!stat.isFile()) return false;
    const contentType = MIME[path.extname(safe).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (contentType === 'video/mp4' && range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      const start = match?.[1] ? Number(match[1]) : 0;
      const end = match?.[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (!match || start > end || start >= stat.size) {
        res.writeHead(416, { ...headers(contentType), 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return true;
      }
      res.writeHead(206, { ...headers(contentType), 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(safe, { start, end }).pipe(res);
      return true;
    }
    res.writeHead(200, { ...headers(contentType), 'Content-Length': stat.size, ...(contentType === 'video/mp4' ? { 'Accept-Ranges': 'bytes' } : {}) });
    fs.createReadStream(safe).pipe(res);
    return true;
  } catch { return false; }
}

function createServer() {
  return http.createServer(async (req, res) => {
    const requestId = crypto.randomUUID();
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const providerName = (process.env.AI_PROVIDER || 'openai').toLowerCase();
        const ready = providerName === 'openai' ? Boolean(process.env.OPENAI_API_KEY) : providerName === 'anthropic' ? Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL) : Boolean(process.env.OLLAMA_MODEL);
        return sendJson(res, 200, { ok: true, guideReady: ready, provider: providerName, supportedProviders, courseVersion: COURSE.version });
      }
      if (req.method === 'POST' && url.pathname === '/api/chat') return await handleChat(req, res);
      if (req.method === 'POST' && url.pathname === '/api/leads') return await handleLead(req, res);
      if (req.method === 'POST' && url.pathname === '/api/checkout') return await handleCheckout(req, res);
      if (req.method === 'GET' && await serveStatic(url.pathname, req, res)) return;
      sendJson(res, 404, { error: 'Not found.', requestId });
    } catch (error) {
      const status = error.name === 'AbortError' ? 504 : error.statusCode || 500;
      if (status >= 500) console.error(`[${requestId}]`, error.message);
      sendJson(res, status, { error: status >= 500 && !error.statusCode ? 'The server could not complete that request.' : error.message, requestId });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, '0.0.0.0', () => console.log(`AI FieldGuide Academy running at http://localhost:${port}`));
}

module.exports = { createServer };
