import { useEffect, useRef } from 'react';
import { drawTemplate } from '../editor/render.js';
import { WIDTH, HEIGHT } from '../editor/model.js';
export default function BackgroundThumb({ background }) {
  const ref = useRef(null);
  useEffect(() => { const ctx = ref.current?.getContext('2d'); if (!ctx || background.type === 'image') return; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 180, 100); ctx.scale(180 / WIDTH, 100 / HEIGHT); drawTemplate(ctx, background); }, [background]);
  return background.type === 'image' ? <img src={background.src} alt=""/> : <canvas ref={ref} width="180" height="100" aria-hidden="true"/>;
}
