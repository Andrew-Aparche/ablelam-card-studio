// Optional adapter: credentials belong in your own backend, never in VITE_* variables.
const base = (import.meta.env.VITE_AI_BASE_URL || '/api').replace(/\/$/, '');
async function request(path, body) {
  const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`AI 요청을 완료하지 못했어요 (${response.status}).`);
  return response.json();
}
export const remoteProvider = {
  mode: 'remote',
  generateBackground: args => request('background', args),
  refineLayout: args => request('refine', args),
};
