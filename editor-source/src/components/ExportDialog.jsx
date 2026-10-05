import { useState } from 'react';
import { Download, Loader2, Check } from 'lucide-react';
import Dialog from './Dialog.jsx';
import CardCanvas from './CardCanvas.jsx';
import { exportCard } from '../editor/render.js';
import { PIXELS_PER_MM } from '../editor/model.js';
export default function ExportDialog({ doc, onClose }) {
  const [format, setFormat] = useState('png'), [scale, setScale] = useState(2), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function download() {
    setBusy(true); setMessage('');
    try { await exportCard(doc, format, scale); setMessage('다운로드를 시작했어요.'); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <Dialog title="명함 이미지 저장" onClose={onClose}>
    <div className="export-preview"><CardCanvas doc={doc} readOnly/></div>
    <fieldset className="export-options"><legend>파일 형식</legend><div className="format-options">{[['png', 'PNG', '또렷한 글자와 선'], ['jpeg', 'JPEG', '작은 파일 크기']].map(([value, label, detail]) => <label className={format === value ? 'chosen' : ''} key={value}><input type="radio" name="format" value={value} checked={format === value} onChange={() => setFormat(value)}/><strong>{label}</strong><span>{detail}</span>{format === value && <Check size={16}/>}</label>)}</div></fieldset>
    <label className="resolution-label">이미지 크기<select aria-label="이미지 크기" value={scale} onChange={e => setScale(Number(e.target.value))}><option value="1">{Math.round(doc.width)} × {Math.round(doc.height)} px</option><option value="2">{Math.round(doc.width * 2)} × {Math.round(doc.height * 2)} px · 고해상도</option></select></label>
    <p className="fine-print">규격 {Number((doc.width / PIXELS_PER_MM).toFixed(1))} × {Number((doc.height / PIXELS_PER_MM).toFixed(1))} mm · RGB 이미지</p>
    <button className="button primary full export-submit" onClick={download} disabled={busy}>{busy ? <Loader2 className="spin"/> : <Download/>}{busy ? '이미지 준비 중…' : `${format.toUpperCase()} 다운로드`}</button><p className="export-status" role="status">{message}</p>
  </Dialog>;
}
