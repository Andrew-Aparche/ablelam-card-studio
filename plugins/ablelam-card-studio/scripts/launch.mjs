import { mkdir, readFile, open } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const workspace = args[args.indexOf('--workspace') + 1];
if (!args.includes('--workspace') || !workspace || !path.isAbsolute(workspace)) {
  console.error('Usage: node launch.mjs --workspace /absolute/task/work/card-studio'); process.exit(1);
}
const sessionDir = path.join(workspace, 'ablelam-session');
const sessionFile = path.join(sessionDir, 'session.json');
await mkdir(sessionDir, { recursive: true });
async function existing() {
  try {
    const session = JSON.parse(await readFile(sessionFile, 'utf8'));
    if (session.plugin !== 'ablelam-card-studio' || session.version !== '0.2.0' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(session.url)) return null;
    const response = await fetch(`${session.url}/bridge/state`, {
      headers: { 'X-Ablelam-Session': session.token }, signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) return null;
    return session;
  } catch { return null; }
}
let session = await existing();
if (!session) {
  const log = await open(path.join(sessionDir, 'server.log'), 'a');
  const child = spawn(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.mjs'), workspace], {
    detached: true, stdio: ['ignore', log.fd, log.fd], windowsHide: true,
  });
  let failure; child.once('error', error => { failure = error; }); child.unref(); await log.close();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (failure) throw failure;
    await new Promise(resolve => setTimeout(resolve, 100));
    session = await existing(); if (session) break;
  }
  if (!session) throw new Error(`Could not start the editor. See ${path.join(sessionDir, 'server.log')}`);
}
// Session credentials remain in the local file; never copy them into chat or the plugin archive.
console.log(JSON.stringify({ url: session.url, sessionFile, workspace }, null, 2));
