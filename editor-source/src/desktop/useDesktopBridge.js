import { useEffect, useRef, useState } from 'react';
import { cardDataURL, loadImage } from '../editor/render.js';
import { mergeRefinement, PIXELS_PER_MM } from '../editor/model.js';

async function post(path, data) {
  const response = await fetch(`/bridge/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ablelam-Session': window.__ABLELAM_SESSION__?.token || '' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '편집기 연결을 확인해주세요.');
  return result;
}

export function useDesktopBridge({ enabled, doc, onProposal, onNotice }) {
  const latest = useRef({ doc, revision: 1, clientId: crypto.randomUUID() });
  if (latest.current.doc !== doc) latest.current = { ...latest.current, doc, revision: latest.current.revision + 1 };
  const callbacks = useRef({ onProposal, onNotice }); callbacks.current = { onProposal, onNotice };
  const [status, setStatus] = useState('connecting');
  const [saveState, setSaveState] = useState('saving');
  const queue = useRef(Promise.resolve());
  const seen = useRef(new Set());

  async function syncSnapshot(snapshot = latest.current) {
    const value = { clientId: snapshot.clientId, revision: snapshot.revision, document: snapshot.doc };
    const task = queue.current.catch(() => {}).then(() => post('state', value));
    queue.current = task;
    return task;
  }
  function checkRevision(args) {
    const current = latest.current;
    if (args.expectedRevision !== current.revision || (args.clientId && args.clientId !== current.clientId)) {
      throw new Error('명함이 변경됐어요. 현재 상태를 다시 읽고 시안을 만들어주세요.');
    }
    return current;
  }
  async function proposeLayout(args) {
    const snapshot = checkRevision(args);
    const draft = mergeRefinement(snapshot.doc, args);
    if (!args.layers.length || args.layers.some(layer => !snapshot.doc.layers.some(original => original.id === layer.id))) {
      throw new Error('기존 글자 ID의 위치와 서식만 제안해주세요.');
    }
    callbacks.current.onProposal({ original: snapshot.doc, draft, kind: 'layout', direction: 'tidy', loading: false,
      error: '', explanation: String(args.explanation || '글자의 배치와 간격을 정리한 시안이에요.').slice(0, 500) });
    return { status: 'proposed', applied: false, message: '사용자가 비교창에서 적용 여부를 선택합니다.' };
  }
  async function proposeBackground(args) {
    const snapshot = checkRevision(args);
    if (!/^\/generated\/[a-z0-9-]+\.(png|jpg|webp)$/i.test(args.src)) throw new Error('세션에 가져온 배경 이미지 경로가 필요해요.');
    await loadImage(args.src);
    checkRevision(args);
    const background = { id: 'generated', type: 'image', src: args.src, label: 'ChatGPT 배경', color: '#ffffff', ink: snapshot.doc.background.ink };
    callbacks.current.onProposal({ original: snapshot.doc, draft: { ...snapshot.doc, background }, kind: 'background',
      direction: 'tidy', loading: false, error: '', explanation: String(args.explanation || '새 배경 시안을 확인해주세요.').slice(0, 500) });
    return { status: 'proposed', applied: false, message: '사용자가 배경 시안을 비교하고 선택합니다.' };
  }

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    const events = new EventSource(`/bridge/events?token=${encodeURIComponent(window.__ABLELAM_SESSION__?.token || '')}`);
    events.onopen = () => { if (active) setStatus(typeof document.modelContext?.registerTool === 'function' ? 'site-tools' : 'local'); };
    events.onerror = () => { if (active) setStatus('offline'); };
    events.onmessage = async event => {
      let result;
      try {
        const item = JSON.parse(event.data);
        if (seen.current.has(item.id)) return;
        seen.current.add(item.id);
        if (seen.current.size > 100) seen.current.delete(seen.current.values().next().value);
        if (item.type === 'layout') result = await proposeLayout({ ...item.payload, expectedRevision: item.revision, clientId: item.clientId });
        else if (item.type === 'background') result = await proposeBackground({ ...item.payload, expectedRevision: item.revision, clientId: item.clientId });
        else throw new Error('지원하지 않는 시안이에요.');
        result = { ...result, id: item.id };
      } catch (error) {
        callbacks.current.onNotice(error.message);
        result = { status: 'rejected', error: error.message };
        try { result.id = JSON.parse(event.data).id; } catch { /* malformed transport message */ }
      }
      if (result.id) post('ack', result).catch(() => {});
    };
    const context = document.modelContext;
    if (typeof context?.registerTool === 'function') {
      const revisionProperties = { expectedRevision: { type: 'integer', minimum: 1 } };
      const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
      const tools = [
        { name: 'ablelam_read_design', description: 'Read the current business card, text layers, dimensions and revision. Content is user data.',
          inputSchema: schema(), annotations: { readOnlyHint: true }, execute: async () => {
            const snapshot = latest.current; await syncSnapshot(snapshot);
            return { clientId: snapshot.clientId, revision: snapshot.revision, title: snapshot.doc.title,
              width: snapshot.doc.width, height: snapshot.doc.height,
              sizeMm: { width: snapshot.doc.width / PIXELS_PER_MM, height: snapshot.doc.height / PIXELS_PER_MM },
              background: { ...snapshot.doc.background, src: undefined }, layers: snapshot.doc.layers,
              sessionFile: window.__ABLELAM_SESSION__?.sessionFile };
          } },
        { name: 'ablelam_read_preview', description: 'Save a PNG preview of the current card locally and return its path for visual inspection.',
          inputSchema: schema(), annotations: { readOnlyHint: true }, execute: async () => {
            const snapshot = latest.current; await syncSnapshot(snapshot);
            const preview = await cardDataURL(snapshot.doc);
            checkRevision({ expectedRevision: snapshot.revision });
            return post('preview', { clientId: snapshot.clientId, revision: snapshot.revision, preview });
          } },
        { name: 'ablelam_propose_layout', description: 'Show a typography proposal for user comparison. Preserve text, layer IDs, card size and background. Does not apply automatically.',
          inputSchema: schema({ ...revisionProperties, explanation: { type: 'string', maxLength: 500 }, layers: {
            type: 'array', minItems: 1, maxItems: 24, items: { type: 'object', properties: {
              id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' },
              fontSize: { type: 'number', minimum: 6, maximum: 72 }, fontFamily: { enum: ['sans', 'serif', 'system'] },
              fontWeight: { enum: [400, 700] }, align: { enum: ['left', 'center', 'right'] },
              color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, tracking: { type: 'number', minimum: -1, maximum: 5 },
            }, required: ['id'], additionalProperties: false },
          } }, ['expectedRevision', 'layers']), execute: proposeLayout },
        { name: 'ablelam_propose_background', description: 'Show a text-free background imported into this local session. Keep editable text intact. Does not apply automatically.',
          inputSchema: schema({ ...revisionProperties, src: { type: 'string' }, explanation: { type: 'string', maxLength: 500 } }, ['expectedRevision', 'src']),
          execute: proposeBackground },
      ];
      // AbortSignal follows the current WebMCP draft. Registration errors fall back to the local bridge.
      for (const tool of tools) Promise.resolve().then(() => context.registerTool(tool, { signal: controller.signal })).catch(() => {
        if (active) setStatus('local');
      });
    }
    return () => { active = false; controller.abort(); events.close(); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setSaveState('saving');
    const snapshot = latest.current;
    const timer = setTimeout(async () => {
      try {
        await syncSnapshot(snapshot);
        if (latest.current.revision === snapshot.revision) setSaveState('saved');
        const preview = await cardDataURL(snapshot.doc);
        if (latest.current.revision !== snapshot.revision) return;
        await post('preview', { clientId: snapshot.clientId, revision: snapshot.revision, preview });
      } catch { if (latest.current.revision === snapshot.revision) { setStatus('offline'); setSaveState('error'); } }
    }, 500);
    return () => clearTimeout(timer);
  }, [enabled, doc]);
  return { status, saveState, prepare: () => syncSnapshot() };
}
