import { useEffect, useState } from 'react';
import { PIXELS_PER_MM, MIN_SIZE_MM, MAX_SIZE_MM } from '../editor/model.js';

export default function SizeControls({ doc, onResize }) {
  const [width, setWidth] = useState(doc.width / PIXELS_PER_MM);
  const [height, setHeight] = useState(doc.height / PIXELS_PER_MM);
  useEffect(() => {
    setWidth(Number((doc.width / PIXELS_PER_MM).toFixed(1)));
    setHeight(Number((doc.height / PIXELS_PER_MM).toFixed(1)));
  }, [doc.width, doc.height]);
  const changed = Number(width) !== Number((doc.width / PIXELS_PER_MM).toFixed(1)) || Number(height) !== Number((doc.height / PIXELS_PER_MM).toFixed(1));
  return <form className="size-controls" aria-label="명함 규격" onSubmit={event => {
    event.preventDefault(); onResize(Number(width), Number(height));
  }}>
    <span className="size-heading">규격</span>
    <label>가로<input aria-label="명함 가로 mm" type="number" min={MIN_SIZE_MM} max={MAX_SIZE_MM} step="0.1" required value={width} onChange={event => setWidth(event.target.value)}/></label>
    <span aria-hidden="true">×</span>
    <label>세로<input aria-label="명함 세로 mm" type="number" min={MIN_SIZE_MM} max={MAX_SIZE_MM} step="0.1" required value={height} onChange={event => setHeight(event.target.value)}/></label>
    <span>mm</span>
    <button type="submit" disabled={!changed}>적용</button>
  </form>;
}
