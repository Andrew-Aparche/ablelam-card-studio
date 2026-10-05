import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isDocument, isProject, migrateProject, faceDocument, replaceFace } from './model.js';
const desktop = Boolean(window.__ABLELAM_SESSION__);
const KEY = desktop ? `ablelam-card-studio:${window.__ABLELAM_SESSION__.workspaceId}:v2` : 'ablelam-card-studio-v2';
function initial() {
  const saved = window.__ABLELAM_INITIAL_DOCUMENT__;
  if (isProject(saved) || isDocument(saved)) return migrateProject(saved);
  // In desktop mode disk is authoritative, including an intentionally empty new workspace.
  if (!desktop) {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('ablm-card-studio-v1'));
      if (isProject(value) || isDocument(value)) return migrateProject(value);
    } catch { /* browser storage unavailable */ }
  }
  return migrateProject(null);
}
export function useDocument() {
  const [project, setProject] = useState(initial), [face, setFace] = useState(() => ['front', 'back'].includes(window.__ABLELAM_SESSION__?.activeFace) ? window.__ABLELAM_SESSION__.activeFace : 'front');
  const doc = useMemo(() => faceDocument(project, face), [project, face]);
  const current = useRef(project), faceRef = useRef(face), history = useRef([]), future = useRef([]);
  faceRef.current = face;
  const [revision, setRevision] = useState(0), [saveState, setSaveState] = useState('saved');
  const mark = useCallback(() => {
    history.current.push(structuredClone(current.current)); history.current = history.current.slice(-60);
    future.current = []; setRevision(r => r + 1);
  }, []);
  const changeProject = useCallback((updater, record = true) => {
    const next = typeof updater === 'function' ? updater(current.current) : updater;
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    if (record) mark();
    current.current = next; setProject(next);
  }, [mark]);
  const change = useCallback((updater, record = true) => {
    changeProject(value => {
      const doc = faceDocument(value, faceRef.current);
      return replaceFace(value, faceRef.current, typeof updater === 'function' ? updater(doc) : updater);
    }, record);
  }, [changeProject]);
  const undo = useCallback(() => {
    if (!history.current.length) return;
    future.current.push(structuredClone(current.current)); const next = history.current.pop();
    current.current = next; setProject(next); setRevision(r => r + 1);
  }, []);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    history.current.push(structuredClone(current.current)); const next = future.current.pop();
    current.current = next; setProject(next); setRevision(r => r + 1);
  }, []);
  useEffect(() => {
    if (desktop) return; // Avoid duplicating customer images in browser storage; the bridge saves to disk.
    setSaveState('saving');
    const timer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(project)); setSaveState('saved'); }
      catch { setSaveState('error'); }
    }, 450);
    return () => clearTimeout(timer);
  }, [project]);
  return { project, doc, face, setFace, change, changeProject, mark, undo, redo, saveState, revision,
    canUndo: history.current.length > 0, canRedo: future.current.length > 0 };
}
