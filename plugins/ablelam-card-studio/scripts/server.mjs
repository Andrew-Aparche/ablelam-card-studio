import http from 'node:http';
import { readFile, writeFile, mkdir, rename, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { isDocument } from './document-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = process.argv[2];
if (!workspace || !path.isAbsolute(workspace)) throw new Error('A session workspace path is required.');
const sessionDir = path.join(workspace, 'ablelam-session');
const generatedDir = path.join(sessionDir, 'generated');
await mkdir(generatedDir, { recursive: true });
const sessionFile = path.join(sessionDir, 'session.json');
const stateFile = path.join(sessionDir, 'state.json');
const previewFile = path.join(sessionDir, 'preview.png');
const token = randomUUID();
let origin, state = null, pending = null, chain = Promise.resolve();
const listeners = new Set();
try { const saved = JSON.parse(await readFile(stateFile, 'utf8')); if (isDocument(saved.document)) state = saved; } catch { /* first launch */ }
async function atomicWrite(file, data) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, data); await rename(temp, file);
}
function mutate(fn) { const next = chain.catch(() => {}).then(fn); chain = next; return next; }
function matches(value) { return state && value.clientId === state.clientId && value.revision === state.revision; }
function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data));
}
async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('JSON is required.');
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 32 * 1024 * 1024) throw new Error('The editor message is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function authorized(value) {
  if (typeof value !== 'string') return false;
  const a = Buffer.from(value), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function conflict() { const error = new Error('The card changed. Read the current design again.'); error.code = 409; return error; }
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    if (req.headers.host !== new URL(origin).host) return sendJSON(res, 403, { error: 'Invalid host.' });
    if (req.headers.origin && req.headers.origin !== origin) return sendJSON(res, 403, { error: 'Invalid origin.' });
    const url = new URL(req.url, origin);
    if (url.pathname === '/health') return sendJSON(res, 200, { plugin: 'ablelam-card-studio', version: '0.2.0' });
    if (url.pathname.startsWith('/bridge/')) {
      if (!authorized(req.headers['x-ablelam-session'] || url.searchParams.get('token'))) return sendJSON(res, 403, { error: 'Invalid session.' });
      if (req.method === 'GET' && url.pathname === '/bridge/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
        res.write(': connected\n\n'); listeners.add(res);
        if (pending) res.write(`data: ${JSON.stringify(pending)}\n\n`);
        const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 25000);
        req.on('close', () => { clearInterval(heartbeat); listeners.delete(res); }); return;
      }
      if (req.method === 'GET' && url.pathname === '/bridge/state') return sendJSON(res, 200, state ? {
        ...state, previewPath: state.previewRevision === state.revision ? previewFile : null, sessionFile,
      } : { document: null, sessionFile });
      if (req.method === 'POST' && url.pathname === '/bridge/state') {
        const body = await jsonBody(req);
        if (typeof body.clientId !== 'string' || body.clientId.length > 80 || !Number.isSafeInteger(body.revision) || body.revision < 1 || !isDocument(body.document)) throw new Error('Invalid design state.');
        await mutate(async () => {
          if (state?.clientId === body.clientId && body.revision < state.revision) throw conflict();
          if (!matches(body)) { pending = null; state = { clientId: body.clientId, revision: body.revision, document: body.document }; }
          else state = { ...state, document: body.document };
          await atomicWrite(stateFile, JSON.stringify(state));
        });
        return sendJSON(res, 200, { saved: true, revision: body.revision });
      }
      if (req.method === 'POST' && url.pathname === '/bridge/preview') {
        const body = await jsonBody(req);
        if (typeof body.preview !== 'string' || !body.preview.startsWith('data:image/png;base64,')) throw new Error('Invalid preview.');
        await mutate(async () => {
          if (!matches(body)) throw conflict();
          const data = Buffer.from(body.preview.slice('data:image/png;base64,'.length), 'base64');
          if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG.');
          await atomicWrite(previewFile, data);
          state = { ...state, previewRevision: body.revision }; await atomicWrite(stateFile, JSON.stringify(state));
        });
        return sendJSON(res, 200, { previewPath: previewFile, clientId: body.clientId, revision: body.revision });
      }
      if (req.method === 'POST' && url.pathname === '/bridge/proposal') {
        const body = await jsonBody(req);
        if (!['layout', 'background'].includes(body.type) || !body.payload || typeof body.payload !== 'object') throw new Error('Invalid proposal.');
        let id;
        await mutate(async () => {
          if (!matches(body)) throw conflict();
          id = randomUUID(); pending = { id, type: body.type, clientId: body.clientId, revision: body.revision, payload: body.payload };
          for (const listener of listeners) listener.write(`data: ${JSON.stringify(pending)}\n\n`);
        });
        return sendJSON(res, 202, { id, status: 'queued', applied: false });
      }
      if (req.method === 'POST' && url.pathname === '/bridge/ack') {
        const body = await jsonBody(req);
        await mutate(async () => {
          if (pending?.id !== body.id) return;
          await atomicWrite(path.join(sessionDir, 'last-proposal.json'), JSON.stringify(body)); pending = null;
        });
        return sendJSON(res, 200, { received: true });
      }
      return sendJSON(res, 404, { error: 'Unknown editor action.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJSON(res, 405, { error: 'Method not supported.' });
    const generated = url.pathname.startsWith('/generated/');
    const folder = generated ? generatedDir : path.join(root, 'assets', 'editor');
    const relative = decodeURIComponent(generated ? url.pathname.slice('/generated/'.length) : url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    const file = await realpath(path.resolve(folder, relative));
    const allowed = await realpath(folder);
    if (!file.startsWith(`${allowed}${path.sep}`)) return sendJSON(res, 403, { error: 'Path outside editor.' });
    let data = await readFile(file);
    if (!generated && relative === 'index.html') {
      const bootstrap = JSON.stringify({ sessionFile, token }).replaceAll('<', '\\u003c');
      const initial = JSON.stringify(state?.document || null).replaceAll('<', '\\u003c');
      data = Buffer.from(data.toString('utf8').replace('</head>', `<script>window.__ABLELAM_SESSION__=${bootstrap};window.__ABLELAM_INITIAL_DOCUMENT__=${initial};</script></head>`));
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) { sendJSON(res, error.code === 'ENOENT' ? 404 : error.code === 409 ? 409 : 400, { error: error.message }); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
await atomicWrite(sessionFile, JSON.stringify({ plugin: 'ablelam-card-studio', version: '0.2.0', url: origin, token, pid: process.pid, workspace }));
console.error(`에이블램 명함 스튜디오: ${origin}`);
function stop() { for (const listener of listeners) listener.end(); server.close(() => process.exit(0)); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
