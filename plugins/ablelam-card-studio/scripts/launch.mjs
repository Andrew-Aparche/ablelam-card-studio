import { mkdir, readFile, open, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
let workspace = args[args.indexOf('--workspace') + 1];
if (!args.includes('--workspace') || !workspace || !path.isAbsolute(workspace)) {
  console.error('Usage: node launch.mjs --workspace /absolute/task/work/card-studio'); process.exit(1);
}
await mkdir(workspace, { recursive: true });
workspace = await realpath(workspace);
const sessionDir = path.join(workspace, 'ablelam-session');
const sessionFile = path.join(sessionDir, 'session.json');
await mkdir(sessionDir, { recursive: true });
async function existing() {
  try {
    const session = JSON.parse(await readFile(sessionFile, 'utf8'));
    if (session.plugin !== 'ablelam-card-studio' || session.version !== '0.3.0' || session.workspace !== workspace || !/^http:\/\/127\.0\.0\.1:\d+$/.test(session.url)) return null;
    const response = await fetch(`${session.url}/bridge/state`, {
      headers: { 'X-Ablelam-Session': session.token }, signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) return null;
    return session;
  } catch { return null; }
}
let session = await existing();
if (!session) {
  // Do not let two plugin versions write the same customer workspace concurrently.
  let previous;
  try { previous = JSON.parse(await readFile(sessionFile, 'utf8')); } catch { /* no previous server */ }
  if (previous?.plugin === 'ablelam-card-studio' && Number.isSafeInteger(previous.pid) && previous.pid > 0) {
    let alive = false;
    try { process.kill(previous.pid, 0); alive = true; } catch (error) { if (error.code === 'EPERM') alive = true; }
    if (alive) {
      const cause = previous.version !== '0.3.0' ? `이전 버전(${previous.version}) 서버가 실행 중이에요.` : '기존 서버 연결을 확인하지 못했어요. 호스트의 승인된 실행 경로로 연결을 확인해주세요.';
      throw new Error(`${cause} 같은 작업 폴더에 서버를 추가로 실행하지 않았어요. 기존 서버를 종료할 때는 저장 완료와 해당 서버의 신원을 먼저 확인해주세요. 기록된 서버 PID: ${previous.pid}`);
    }
  }


  const log = await open(path.join(sessionDir, 'server.log'), 'a');
  const child = spawn(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.mjs'), workspace], {
    detached: true, stdio: ['ignore', log.fd, log.fd], windowsHide: true,
  });
  let failure; child.once('error', error => { failure = error; }); child.once('exit', code => { if (code !== 0) failure = new Error('로컬 서버가 시작되지 못했어요.'); }); child.unref(); await log.close();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (failure) {
      const tail = (await readFile(path.join(sessionDir, 'server.log'), 'utf8').catch(() => '')).slice(-1500);
      if (/EPERM|EACCES/.test(tail)) throw new Error('로컬 서버 실행 권한이 필요해요. 호스트의 승인 절차로 동일한 실행 명령을 다시 실행해주세요.');
      throw new Error(`${failure.message} 자세한 내용: ${path.join(sessionDir, 'server.log')}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    session = await existing(); if (session) break;
  }
  if (!session) throw new Error(`Could not start the editor. See ${path.join(sessionDir, 'server.log')}`);
}
// Session credentials remain in the local file; never copy them into chat or the plugin archive.
console.log(JSON.stringify({ url: session.url, sessionFile, workspace, workspaceId: session.workspaceId }, null, 2));
