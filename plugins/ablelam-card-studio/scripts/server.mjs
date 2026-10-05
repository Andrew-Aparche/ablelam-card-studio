import http from 'node:http';
import { readFile, writeFile, mkdir, rename, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { isDocument, isProject, migrateProject, faceDocument, faceFingerprint, mergeRefinement, SIDES, SIDE_LABELS } from './document-model.mjs';

const VERSION = '0.3.0';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputWorkspace = process.argv[2];
if (!inputWorkspace || !path.isAbsolute(inputWorkspace)) throw new Error('A session workspace path is required.');
await mkdir(inputWorkspace, { recursive: true });
const workspace = await realpath(inputWorkspace);
const sessionDir = path.join(workspace, 'ablelam-session');
const generatedDir = path.join(sessionDir, 'generated'), exportsDir = path.join(sessionDir, 'exports');
await mkdir(generatedDir, { recursive: true }); await mkdir(exportsDir, { recursive: true });
const sessionFile = path.join(sessionDir, 'session.json'), stateFile = path.join(sessionDir, 'state.json');
const proposalsFile = path.join(sessionDir, 'proposals.json'), exportsFile = path.join(sessionDir, 'exports.json');
const token = randomUUID();
let workspaceId;
try { workspaceId = (await readFile(path.join(sessionDir, 'workspace-id'), 'utf8')).trim(); } catch { /* first launch */ }
if (!/^[a-f0-9-]{36}$/i.test(workspaceId || '')) { workspaceId = randomUUID(); await writeFile(path.join(sessionDir, 'workspace-id'), workspaceId); }
let origin, state = null, chain = Promise.resolve(), proposals = [], exportsList = [];
const listeners = new Set(), waiters = new Map();
const terminal = new Set(['applied', 'declined', 'invalidated', 'rejected']);
try {
  const saved = JSON.parse(await readFile(stateFile, 'utf8'));
  const document = saved.project || saved.document;
  if (isProject(document) || isDocument(document)) {
    if (isDocument(document)) await writeFile(path.join(sessionDir, 'state-v1.backup.json'), JSON.stringify(saved), { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    state = { ...saved, project: migrateProject(document), faceRevisions: saved.faceRevisions || { front: 1, back: 1 }, activeFace: SIDES.includes(saved.activeFace) ? saved.activeFace : 'front' };
    delete state.document;
  }
} catch (error) { if (error.code !== 'ENOENT') throw new Error(`저장 문서를 복원하지 못했어요. 원본을 보존했어요: ${stateFile}`); }
try { proposals = JSON.parse(await readFile(proposalsFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
try { exportsList = JSON.parse(await readFile(exportsFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
async function atomicWrite(file, data) {
  const temp = `${file}.${randomUUID()}.tmp`; await writeFile(temp, data); await rename(temp, file);
}
function mutate(fn) { const next = chain.catch(() => {}).then(fn); chain = next; return next; }
function conflict() { const error = new Error('명함이 변경됐어요. 대상 면의 현재 상태를 다시 읽어주세요.'); error.code = 409; return error; }
function matchesFace(value) { return state && SIDES.includes(value.face) && value.clientId === state.clientId && value.revision === state.faceRevisions[value.face]; }
function resultOf(record) {
  if (!record) return null;
  return { id: record.id, face: record.face, status: record.status, applied: record.status === 'applied',
    createdAt: record.createdAt, updatedAt: record.updatedAt, appliedAt: record.appliedAt, error: record.error,
    resultingRevision: record.resultingRevision };
}
function notify(record) {
  if (record.status !== 'queued') {
    for (const done of waiters.get(record.id) || []) done(resultOf(record));
    waiters.delete(record.id);
  }
}
async function saveProposals() { proposals = proposals.slice(-200); await atomicWrite(proposalsFile, JSON.stringify(proposals)); }
function transition(record, status, extra = {}) {
  record.status = status; record.updatedAt = new Date().toISOString(); Object.assign(record, extra); notify(record);
}
async function waitForDelivery(id, ms = 4000) {
  const record = proposals.find(p => p.id === id);
  if (record?.status !== 'queued') return resultOf(record);
  return new Promise(resolve => {
    const done = value => { clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => {
      const set = waiters.get(id); set?.delete(done); if (!set?.size) waiters.delete(id);
      resolve({ ...resultOf(proposals.find(p => p.id === id)), deliveryTimedOut: true });
    }, ms);
    if (!waiters.has(id)) waiters.set(id, new Set()); waiters.get(id).add(done);
  });
}
function sendJSON(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
async function bodyBytes(req, limit = 64 * 1024 * 1024) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > limit) throw new Error('저장 데이터가 너무 커요. 이미지 크기를 낮춰주세요.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('JSON is required.');
  return JSON.parse((await bodyBytes(req)).toString('utf8'));
}
function authorized(value) {
  if (typeof value !== 'string') return false;
  const a = Buffer.from(value), b = Buffer.from(token); return a.length === b.length && timingSafeEqual(a, b);
}
function faceState(face) {
  return state ? { document: faceDocument(state.project, face), project: state.project, activeFace: state.activeFace, face,
    clientId: state.clientId, revision: state.faceRevisions[face], stateRevision: state.revision, faceRevisions: state.faceRevisions,
    savedAt: state.savedAt, workspaceId, sessionFile,
    previewPath: state.previews?.[face] === state.faceRevisions[face] ? path.join(sessionDir, `preview-${face}.png`) : null,
    proposals: proposals.map(resultOf), exports: exportsList.slice(-10) } : { document: null, face, workspaceId, sessionFile };
}
function proposalDraft(record, project) {
  const doc = faceDocument(project, record.face);
  if (record.type === 'layout') return mergeRefinement(doc, record.payload);
  return { ...doc, background: { id: 'generated', type: 'image', src: record.payload.src, label: 'ChatGPT 배경', color: '#ffffff', ink: doc.background.ink } };
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    if (req.headers.host !== new URL(origin).host) return sendJSON(res, 403, { error: 'Invalid host.' });
    if (req.headers.origin && req.headers.origin !== origin) return sendJSON(res, 403, { error: 'Invalid origin.' });
    const url = new URL(req.url, origin);
    if (url.pathname === '/health') return sendJSON(res, 200, { plugin: 'ablelam-card-studio', version: VERSION });
    if (url.pathname.startsWith('/bridge/')) {
      if (!authorized(req.headers['x-ablelam-session'] || url.searchParams.get('token'))) return sendJSON(res, 403, { error: 'Invalid session.' });
      if (req.method === 'GET' && url.pathname === '/bridge/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' }); res.write(': connected\n\n'); listeners.add(res);
        for (const pending of proposals.filter(p => p.status === 'queued')) res.write(`data: ${JSON.stringify(pending)}\n\n`);
        const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 25000);
        req.on('close', () => { clearInterval(heartbeat); listeners.delete(res); }); return;
      }
      if (req.method === 'GET' && url.pathname === '/bridge/state') {
        const face = url.searchParams.get('face') || state?.activeFace || 'front';
        if (!SIDES.includes(face)) throw new Error('Invalid face.'); return sendJSON(res, 200, faceState(face));
      }
      if (req.method === 'POST' && url.pathname === '/bridge/state') {
        const body = await jsonBody(req);
        if (typeof body.clientId !== 'string' || body.clientId.length > 80 || !Number.isSafeInteger(body.revision) || body.revision < 1 ||
          !isProject(body.project) || !SIDES.includes(body.activeFace) || !SIDES.every(face => Number.isSafeInteger(body.faceRevisions?.[face]) && body.faceRevisions[face] >= 1)) throw new Error('Invalid design state.');
        await mutate(async () => {
          if (state?.clientId === body.clientId && body.revision < state.revision) throw conflict();
          // Revisions are assertions about content, not a way to bypass stale proposal protection.
          if (state?.clientId === body.clientId) for (const face of SIDES) {
            const changed = faceFingerprint(faceDocument(state.project, face)) !== faceFingerprint(faceDocument(body.project, face));
            if (body.faceRevisions[face] < state.faceRevisions[face] || (changed && body.faceRevisions[face] <= state.faceRevisions[face])) throw conflict();
          }
          let applied;
          if (body.appliedProposalId) {
            applied = proposals.find(p => p.id === body.appliedProposalId);
            if (!applied || applied.status !== 'proposed' || !matchesFace(applied) ||
              faceFingerprint(proposalDraft(applied, state.project)) !== faceFingerprint(faceDocument(body.project, applied.face))) throw conflict();
          }
          const previous = state;
          state = { clientId: body.clientId, revision: body.revision, faceRevisions: body.faceRevisions, activeFace: body.activeFace,
            project: body.project, savedAt: new Date().toISOString(), previews: previous?.clientId === body.clientId ? previous.previews || {} : {} };
          await atomicWrite(stateFile, JSON.stringify(state));
          for (const record of proposals) {
            if (terminal.has(record.status)) continue;
            if (record === applied) transition(record, 'applied', { appliedAt: state.savedAt, resultingRevision: state.faceRevisions[record.face] });
            else if (!matchesFace(record)) transition(record, 'invalidated', { error: '대상 면의 내용 또는 규격이 변경됐어요.' });
          }
          await saveProposals();
        });
        return sendJSON(res, 200, { saved: true, savedAt: state.savedAt, revision: body.revision, proposals: proposals.map(resultOf) });
      }
      if (req.method === 'POST' && url.pathname === '/bridge/preview') {
        const body = await jsonBody(req);
        if (typeof body.preview !== 'string' || !body.preview.startsWith('data:image/png;base64,')) throw new Error('Invalid preview.');
        await mutate(async () => {
          if (!matchesFace(body)) throw conflict();
          const data = Buffer.from(body.preview.slice('data:image/png;base64,'.length), 'base64');
          if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG.');
          await atomicWrite(path.join(sessionDir, `preview-${body.face}.png`), data);
          state = { ...state, previews: { ...state.previews, [body.face]: body.revision } }; await atomicWrite(stateFile, JSON.stringify(state));
        });
        return sendJSON(res, 200, { previewPath: path.join(sessionDir, `preview-${body.face}.png`), face: body.face, revision: body.revision });
      }
      if (req.method === 'POST' && url.pathname === '/bridge/proposal') {
        const body = await jsonBody(req);
        if (!['layout', 'background'].includes(body.type) || !body.payload || typeof body.payload !== 'object') throw new Error('Invalid proposal.');
        let record;
        await mutate(async () => {
          if (!matchesFace(body)) throw conflict();
          const doc = faceDocument(state.project, body.face);
          if (body.type === 'layout' && (!Array.isArray(body.payload.layers) || !body.payload.layers.length || body.payload.layers.some(layer => !doc.layers.some(original => original.id === layer.id)))) throw new Error('기존 글자 ID의 위치와 서식만 제안해주세요.');
          if (body.type === 'background') {
            if (!/^\/generated\/[a-z0-9-]+\.(png|jpg|webp)$/i.test(body.payload.src || '')) throw new Error('세션에 가져온 배경 경로가 필요해요.');
            await readFile(path.join(generatedDir, path.basename(body.payload.src)));
          }
          for (const previous of proposals) if (!terminal.has(previous.status)) transition(previous, 'invalidated', { error: '새 비교 시안으로 대체됐어요.' });
          const now = new Date().toISOString();
          record = { id: randomUUID(), type: body.type, face: body.face, clientId: body.clientId, revision: body.revision,
            payload: body.payload, status: 'queued', createdAt: now, updatedAt: now };
          proposals.push(record); await saveProposals();
          for (const listener of listeners) listener.write(`data: ${JSON.stringify(record)}\n\n`);
        });
        const result = await waitForDelivery(record.id);
        return sendJSON(res, result.status === 'queued' ? 202 : 200, result);
      }
      if (req.method === 'GET' && url.pathname === '/bridge/proposals') {
        const id = url.searchParams.get('id');
        return sendJSON(res, 200, id ? resultOf(proposals.find(p => p.id === id)) || { id, status: 'unknown' } : proposals.map(resultOf));
      }
      if (req.method === 'POST' && url.pathname === '/bridge/ack') {
        const body = await jsonBody(req); let result;
        await mutate(async () => {
          const record = proposals.find(p => p.id === body.id);
          if (!record) throw new Error('시안 기록을 찾지 못했어요.');
          if (!['proposed', 'declined', 'invalidated', 'rejected'].includes(body.status)) throw new Error('Invalid proposal status.');
          if (terminal.has(record.status)) { result = resultOf(record); return; }
          if (body.status === 'proposed' && !matchesFace(record)) transition(record, 'invalidated', { error: '명함이 변경됐어요.' });
          else transition(record, body.status, { error: String(body.error || '').slice(0, 500) });
          await saveProposals(); result = resultOf(record);
        });
        return sendJSON(res, 200, result);
      }
      if (req.method === 'GET' && url.pathname === '/bridge/exports') return sendJSON(res, 200, exportsList.slice(-20));
      if (req.method === 'POST' && url.pathname === '/bridge/export') {
        const face = url.searchParams.get('face'), revision = Number(url.searchParams.get('revision'));
        const clientId = req.headers['x-ablelam-client'];
        if (!matchesFace({ face, revision, clientId })) throw conflict();
        const type = req.headers['content-type'], data = await bodyBytes(req);
        const png = type === 'image/png' && data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
        const jpeg = type === 'image/jpeg' && data[0] === 255 && data[1] === 216 && data[2] === 255 && data.at(-2) === 255 && data.at(-1) === 217;
        if (!png && !jpeg) throw new Error('PNG 또는 JPEG 이미지가 필요해요.');
        let result;
        await mutate(async () => {
          if (!matchesFace({ face, revision, clientId })) throw conflict();
          const title = (url.searchParams.get('title') || '명함').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+|[. ]+$/g, '').slice(0, 60) || '명함';
          const savedAt = new Date().toISOString();
          const stamp = savedAt.replace(/[-:]/g, '').replace('T', '-').replace(/\.\d+Z$/, '');
          const filename = `${title}_${SIDE_LABELS[face]}_${stamp}_${randomUUID().slice(0, 8)}.${png ? 'png' : 'jpg'}`;
          const file = path.join(exportsDir, filename); await atomicWrite(file, data);
          result = { id: randomUUID(), status: 'saved', face, filename, path: file, url: `/exports/${encodeURIComponent(filename)}`,
            bytes: data.length, savedAt, revision, workspaceId, requestId: /^[a-f0-9-]{36}$/i.test(url.searchParams.get('requestId') || '') ? url.searchParams.get('requestId') : null };
          exportsList.push(result); exportsList = exportsList.slice(-100);
          try { await atomicWrite(exportsFile, JSON.stringify(exportsList)); }
          catch { result.warning = '원본 파일은 저장했지만 저장 이력 기록에 실패했어요. 아래 경로를 보관해주세요.'; }
        });
        return sendJSON(res, 200, result);
      }
      return sendJSON(res, 404, { error: 'Unknown editor action.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJSON(res, 405, { error: 'Method not supported.' });
    const generated = url.pathname.startsWith('/generated/'), exported = url.pathname.startsWith('/exports/');
    const folder = generated ? generatedDir : exported ? exportsDir : path.join(root, 'assets', 'editor');
    const relative = decodeURIComponent(generated ? url.pathname.slice(11) : exported ? url.pathname.slice(9) : url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    const file = await realpath(path.resolve(folder, relative)), allowed = await realpath(folder);
    if (!file.startsWith(`${allowed}${path.sep}`)) return sendJSON(res, 403, { error: 'Path outside editor.' });
    let data = await readFile(file);
    if (!generated && !exported && relative === 'index.html') {
      const bootstrap = JSON.stringify({ sessionFile, token, workspaceId, savedAt: state?.savedAt, activeFace: state?.activeFace }).replaceAll('<', '\\u003c');
      const initial = JSON.stringify(state?.project || null).replaceAll('<', '\\u003c');
      data = Buffer.from(data.toString('utf8').replace('</head>', `<script>window.__ABLELAM_SESSION__=${bootstrap};window.__ABLELAM_INITIAL_DOCUMENT__=${initial};</script></head>`));
    }
    if (exported) res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) { sendJSON(res, error.code === 'ENOENT' ? 404 : error.code === 409 ? 409 : 400, { error: error.message }); }
});
server.on('error', error => { console.error(error.code === 'EPERM' || error.code === 'EACCES' ? `로컬 서버 실행 권한이 필요해요 (${error.code}). 호스트의 승인 절차로 실행해주세요.` : error); process.exitCode = 1; });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
origin = `http://127.0.0.1:${server.address().port}`;
await atomicWrite(sessionFile, JSON.stringify({ plugin: 'ablelam-card-studio', version: VERSION, url: origin, token, pid: process.pid, workspace, workspaceId }));
console.error(`에이블램 명함 스튜디오: ${origin}`);
function stop() { for (const listener of listeners) listener.end(); server.close(() => process.exit(0)); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
