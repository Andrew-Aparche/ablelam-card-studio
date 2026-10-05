import { useCallback, useEffect, useRef, useState } from 'react';
import { createDocument, isDocument, cleanLayer } from './model.js';
const KEY = 'ablm-card-studio-v1';
function initial() {
  const desktopDocument = window.__ABLELAM_INITIAL_DOCUMENT__;
  if (isDocument(desktopDocument)) return { ...desktopDocument, layers: desktopDocument.layers.map(layer => cleanLayer(layer, desktopDocument)) };
  try { const value = JSON.parse(localStorage.getItem(KEY)); if (isDocument(value)) return { ...value, layers: value.layers.map(layer => cleanLayer(layer, value)) }; } catch { /* storage unavailable or invalid */ }
  return createDocument();
}
export function useDocument() {
  const [doc, setDoc] = useState(initial);
  const current = useRef(doc), history = useRef([]), future = useRef([]);
  const [revision, setRevision] = useState(0), [saveState, setSaveState] = useState('saved');
  const mark = useCallback(() => { history.current.push(structuredClone(current.current)); history.current = history.current.slice(-60); future.current = []; setRevision(r => r + 1); }, []);
  const change = useCallback((updater, record = true) => {
    const next = typeof updater === 'function' ? updater(current.current) : updater;
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    if (record) mark();
    current.current = next; setDoc(next);
  }, [mark]);
  const undo = useCallback(() => {
    if (!history.current.length) return;
    future.current.push(structuredClone(current.current)); const next = history.current.pop();
    current.current = next; setDoc(next); setRevision(r => r + 1);
  }, []);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    history.current.push(structuredClone(current.current)); const next = future.current.pop();
    current.current = next; setDoc(next); setRevision(r => r + 1);
  }, []);
  useEffect(() => {
    setSaveState('saving');
    const timer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(doc)); setSaveState('saved'); }
      catch { setSaveState('error'); }
    }, 450);
    return () => clearTimeout(timer);
  }, [doc]);
  return { doc, change, mark, undo, redo, saveState, revision, canUndo: history.current.length > 0, canRedo: future.current.length > 0 };
}
