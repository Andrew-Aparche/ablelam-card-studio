import { useEffect, useRef, useState } from 'react';
import { clamp } from '../editor/model.js';
import { renderCard } from '../editor/render.js';
export default function CardCanvas({ doc, selected, onSelect, onMove, onGestureStart, onEdit, readOnly = false, className = '' }) {
  const { width: WIDTH, height: HEIGHT } = doc;
  const canvas = useRef(null), drag = useRef(null), frame = useRef(null), [boxes, setBoxes] = useState({}), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const scratch = document.createElement('canvas');
    renderCard(scratch, doc, Math.min(1.5, 1800 / Math.max(WIDTH, HEIGHT))).then(layout => {
      if (!active || !canvas.current) return;
      canvas.current.width = scratch.width; canvas.current.height = scratch.height;
      canvas.current.getContext('2d').drawImage(scratch, 0, 0); setBoxes(layout); setError('');
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [doc]);
  function start(event, layer) {
    if (event.button !== 0) return;
    event.preventDefault(); onSelect(layer.id); event.currentTarget.focus();
    const box = boxes[layer.id]; if (!box) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: layer.id, px: event.clientX, py: event.clientY, x: layer.x, y: layer.y, width: layer.width, box, changed: false };
  }
  function move(event) {
    const current = drag.current; if (!current) return;
    const rect = frame.current.getBoundingClientRect();
    const dx = (event.clientX - current.px) * WIDTH / rect.width;
    const dy = (event.clientY - current.py) * HEIGHT / rect.height;
    if (!current.changed && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!current.changed) { onGestureStart(); current.changed = true; }
    const actualDx = clamp(dx, 8 - current.box.x, WIDTH - current.box.x - current.box.width - 8);
    const actualDy = clamp(dy, 8 - current.box.y, HEIGHT - current.box.y - current.box.height - 8);
    const x = Math.max(8, current.x + actualDx);
    onMove(current.id, { x, y: Math.max(8, current.y + actualDy), width: Math.min(current.width, WIDTH - x - 8) }, false);
  }
  return <div ref={frame} className={`card-canvas ${className}`} style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, '--card-ratio': WIDTH / HEIGHT }} onPointerDown={event => { if (event.target === canvas.current && !readOnly) onSelect(null); }}>
    <canvas ref={canvas} aria-label={`명함 미리보기: ${doc.layers.map(l => l.text).filter(Boolean).join(', ')}`} />
    {!readOnly && doc.layers.filter(l => l.text.trim()).map(layer => {
      const box = boxes[layer.id]; if (!box) return null;
      return <button key={layer.id} type="button" className={`text-hit ${selected === layer.id ? 'selected' : ''}`} aria-label={`${layer.label} 텍스트: ${layer.text}`} aria-pressed={selected === layer.id}
        style={{ left: `${box.x / WIDTH * 100}%`, top: `${box.y / HEIGHT * 100}%`, width: `${box.width / WIDTH * 100}%`, height: `${box.height / HEIGHT * 100}%` }}
        onFocus={() => onSelect(layer.id)} onDoubleClick={() => onEdit?.(layer.id)} onPointerDown={event => start(event, layer)} onPointerMove={move}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onKeyDown={event => {
          const delta = event.shiftKey ? 10 : 2;
          const offsets = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
          if (offsets[event.key]) { event.preventDefault(); onMove(layer.id, { x: clamp(layer.x + offsets[event.key][0], 8, WIDTH - box.width - 8), y: clamp(layer.y + offsets[event.key][1], 8, HEIGHT - box.height - 8) }); }
        }}><span className="sr-only">드래그 또는 방향키로 이동</span><i className="handle tl"/><i className="handle tr"/><i className="handle bl"/><i className="handle br"/></button>;
    })}
    {error && <div className="canvas-error" role="alert">{error}</div>}
  </div>;
}
