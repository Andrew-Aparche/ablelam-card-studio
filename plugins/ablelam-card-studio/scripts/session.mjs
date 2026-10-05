import { readFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { faceDocument, SIDES } from './document-model.mjs';

const [action, ...args] = process.argv.slice(2);
function option(name) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; }
const sessionFile = option('--session');
if (!sessionFile || !path.isAbsolute(sessionFile)) throw new Error('An absolute --session path is required.');
const session = JSON.parse(await readFile(sessionFile, 'utf8'));
if (session.plugin !== 'ablelam-card-studio' || session.version !== '0.3.0' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(session.url)) throw new Error('업데이트된 플러그인으로 스튜디오를 다시 열어주세요.');
const directory = path.dirname(sessionFile);
async function savedState() { return JSON.parse(await readFile(path.join(directory, 'state.json'), 'utf8')); }
async function request(endpoint, data) {
  const response = await fetch(`${session.url}/bridge/${endpoint}`, {
    method: data ? 'POST' : 'GET', headers: { 'X-Ablelam-Session': session.token, 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(15000),
  });
  const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
}
function targetFace(state) {
  const face = option('--face') || state.activeFace || 'front';
  if (!SIDES.includes(face)) throw new Error('Use --face front or --face back.'); return face;
}
function publicProposal(record) {
  if (!record) return { status: 'unknown' };
  const { id, face, status, createdAt, updatedAt, appliedAt, error, resultingRevision } = record;
  return { id, face, status, applied: status === 'applied', createdAt, updatedAt, appliedAt, error, resultingRevision };
}
if (action === 'read') {
  const state = await savedState(), face = targetFace(state);
  const document = faceDocument(state.project, face);
  if (!document) throw new Error('Open the updated editor before reading the design.');
  document.background = { ...document.background, src: undefined };
  console.log(JSON.stringify({ source: 'last_saved_local_file', savedAt: state.savedAt, workspaceId: session.workspaceId,
    face, activeFace: state.activeFace, clientId: state.clientId, revision: state.faceRevisions[face], faceRevisions: state.faceRevisions,
    document, previewPath: state.previews?.[face] === state.faceRevisions[face] ? path.join(directory, `preview-${face}.png`) : null }, null, 2));
} else if (action === 'layout') {
  const value = JSON.parse(await readFile(option('--file'), 'utf8'));
  if (!value.clientId || !SIDES.includes(value.face) || !Number.isSafeInteger(value.expectedRevision) || !Array.isArray(value.layers)) throw new Error('A layout file needs face, clientId, expectedRevision and layers.');
  console.log(JSON.stringify(await request('proposal', { type: 'layout', face: value.face, clientId: value.clientId, revision: value.expectedRevision,
    payload: { layers: value.layers, explanation: value.explanation } }), null, 2));
} else if (action === 'background') {
  const clientId = option('--client'), revision = Number(option('--revision')), image = option('--image');
  if (!clientId || !Number.isSafeInteger(revision) || !image || !path.isAbsolute(image)) throw new Error('Use --client, --revision and an absolute --image path.');
  const current = await savedState(), face = targetFace(current);
  if (current.clientId !== clientId || current.faceRevisions[face] !== revision) throw new Error('대상 면이 변경됐어요. 현재 상태를 다시 읽어주세요.');
  const header = (await readFile(image)).subarray(0, 12);
  const ext = header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? 'png'
    : header[0] === 255 && header[1] === 216 && header[2] === 255 ? 'jpg'
    : header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null;
  if (!ext) throw new Error('Use a PNG, JPEG or WebP background.');
  const generated = path.join(directory, 'generated'); await mkdir(generated, { recursive: true });
  const name = `${randomUUID()}.${ext}`; await copyFile(image, path.join(generated, name)); const src = `/generated/${name}`;
  if (option('--prepare-only') === 'true') console.log(JSON.stringify({ src, face, clientId, revision }, null, 2));
  else console.log(JSON.stringify(await request('proposal', { type: 'background', face, clientId, revision, payload: { src } }), null, 2));
} else if (action === 'status') {
  let records = [];
  try { records = JSON.parse(await readFile(path.join(directory, 'proposals.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const id = option('--id');
  console.log(JSON.stringify(id ? publicProposal(records.find(item => item.id === id)) : records.length ? publicProposal(records.at(-1)) : { status: 'no_proposals' }, null, 2));
} else if (action === 'exports') {
  let records = [];
  try { records = JSON.parse(await readFile(path.join(directory, 'exports.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  console.log(JSON.stringify(records.slice(-20), null, 2));
} else throw new Error('Use read, layout, background, status or exports.');
