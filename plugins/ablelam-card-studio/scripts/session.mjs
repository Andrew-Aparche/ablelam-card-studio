import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const [action, ...args] = process.argv.slice(2);
function option(name) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; }
const sessionFile = option('--session');
if (!sessionFile || !path.isAbsolute(sessionFile)) throw new Error('An absolute --session path is required.');
const session = JSON.parse(await readFile(sessionFile, 'utf8'));
if (session.plugin !== 'ablelam-card-studio' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(session.url)) throw new Error('Invalid session file.');
async function request(endpoint, data) {
  const response = await fetch(`${session.url}/bridge/${endpoint}`, {
    method: data ? 'POST' : 'GET', headers: { 'X-Ablelam-Session': session.token, 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(10000),
  });
  const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
}
if (action === 'read') {
  const state = await request('state');
  if (!state.document) throw new Error('Open the editor page before reading the design.');
  state.document.background = { ...state.document.background, src: undefined };
  console.log(JSON.stringify(state, null, 2));
} else if (action === 'layout') {
  const value = JSON.parse(await readFile(option('--file'), 'utf8'));
  if (!value.clientId || !Number.isSafeInteger(value.expectedRevision) || !Array.isArray(value.layers)) throw new Error('A layout file needs clientId, expectedRevision and layers.');
  console.log(JSON.stringify(await request('proposal', { type: 'layout', clientId: value.clientId, revision: value.expectedRevision,
    payload: { layers: value.layers, explanation: value.explanation } }), null, 2));
} else if (action === 'background') {
  const clientId = option('--client'), revision = Number(option('--revision'));
  const image = option('--image');
  if (!clientId || !Number.isSafeInteger(revision) || !image || !path.isAbsolute(image)) throw new Error('Use --client, --revision and an absolute --image path.');
  const current = await request('state');
  if (current.clientId !== clientId || current.revision !== revision) throw new Error('The card changed. Read the current design again.');
  const header = (await readFile(image)).subarray(0, 12);
  const ext = header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? 'png'
    : header[0] === 255 && header[1] === 216 && header[2] === 255 ? 'jpg'
    : header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null;
  if (!ext) throw new Error('Use a PNG, JPEG or WebP background.');
  const generated = path.join(path.dirname(sessionFile), 'generated'); await mkdir(generated, { recursive: true });
  const name = `${randomUUID()}.${ext}`; await copyFile(image, path.join(generated, name));
  const src = `/generated/${name}`;
  if (option('--prepare-only') === 'true') console.log(JSON.stringify({ src, clientId, revision }, null, 2));
  else console.log(JSON.stringify(await request('proposal', { type: 'background', clientId, revision, payload: { src } }), null, 2));
} else if (action === 'status') {
  try { console.log(await readFile(path.join(path.dirname(sessionFile), 'last-proposal.json'), 'utf8')); }
  catch { console.log(JSON.stringify({ status: 'pending_or_no_proposal', applied: false })); }
} else throw new Error('Use read, layout, background or status.');
