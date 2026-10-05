import { useEffect, useState } from 'react';
import { Download, Loader2, Check, Copy, FolderCheck } from 'lucide-react';
import Dialog from './Dialog.jsx';
import CardCanvas from './CardCanvas.jsx';
import { exportCard } from '../editor/render.js';
import { faceDocument, PIXELS_PER_MM, SIDE_LABELS } from '../editor/model.js';
export default function ExportDialog({ project, face, desktop, bridge, onClose }) {
  const [snapshot] = useState(() => structuredClone(project));
  const doc = faceDocument(snapshot, face);
  const [format, setFormat] = useState('png'), [scale, setScale] = useState(2), [target, setTarget] = useState('current');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [results, setResults] = useState([]), [recent, setRecent] = useState([]);
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    bridge.listExports().then(items => { if (active) setRecent(items.slice(-4).reverse()); }).catch(() => {});
    return () => { active = false; };
  }, []);
  function options(setter, value) { setter(value); setResults([]); setMessage(''); }
  async function save(retry = false) {
    setBusy(true); setMessage('');
    const sides = retry ? results.filter(item => item.status === 'failed').map(item => item.face) : target === 'both' ? ['front', 'back'] : [face];
    let next = retry ? [...results] : [];
    if (!retry) setResults([]);
    for (const side of sides) {
      let item;
      try {
        item = desktop ? await bridge.saveImage(faceDocument(snapshot, side), side, format, scale)
          : { ...await exportCard(faceDocument(snapshot, side), format, scale, `_${SIDE_LABELS[side]}`), face: side };
      } catch (error) { item = { face: side, status: error.outcomeUnknown ? 'unknown' : 'failed', error: error.message || '이미지를 저장하지 못했어요.' }; }
      next = [...next.filter(result => result.face !== side), item]; setResults(next);
    }
    const failed = next.some(item => ['failed', 'unknown'].includes(item.status));
    setMessage(failed ? '일부 파일을 저장하지 못했어요. 아래 사유를 확인해주세요.' : desktop ? '작업 폴더에 원본 파일을 저장했어요.' : '브라우저에 다운로드를 요청했어요. 완료 여부는 브라우저에서 확인해주세요.');
    if (desktop) bridge.listExports().then(items => setRecent(items.slice(-4).reverse())).catch(() => {});
    setBusy(false);
  }
  async function copyPath(file) {
    try { await navigator.clipboard.writeText(file.path); setMessage('원본 파일의 저장 위치를 복사했어요.'); }
    catch { setMessage('저장 경로를 선택해서 직접 복사해주세요.'); }
  }
  function fileResult(item) {
    return <li key={item.id || item.face} className={`saved-file ${item.status === 'failed' ? 'failed' : ''}`}>
      <strong>{SIDE_LABELS[item.face]} · {item.status === 'saved' ? '원본 저장 완료' : item.status === 'failed' ? '저장 실패' : item.status === 'unknown' ? '저장 결과 확인 필요' : '다운로드 요청'}</strong>
      {item.filename && <span>{item.filename}</span>}
      {item.path && <code>{item.path}</code>}
      {item.error && <span>{item.error}</span>}{item.warning && <span>{item.warning}</span>}
      {item.savedAt && <small>{new Date(item.savedAt).toLocaleString('ko-KR')} · {Math.ceil(item.bytes / 1024).toLocaleString()} KB</small>}
      {item.status === 'saved' && <div className="saved-file-actions"><button className="button" onClick={() => copyPath(item)}><Copy size={14}/>저장 위치 복사</button><a className="button" href={item.url} download={item.filename}>복사본 다운로드</a></div>}
    </li>;
  }
  return <Dialog title="명함 이미지 저장" onClose={() => { if (!busy) onClose(); }}>
    <div className="export-preview"><CardCanvas doc={doc} readOnly/></div>
    <fieldset className="export-options"><legend>저장 대상</legend><div className="format-options">{[['current', `${SIDE_LABELS[face]}만`, '현재 편집 중인 면'], ['both', '앞·뒷면 모두', '각각 별도 파일로 저장']].map(([value, label, detail]) => <label className={target === value ? 'chosen' : ''} key={value}><input disabled={busy} type="radio" name="target" value={value} checked={target === value} onChange={() => options(setTarget, value)}/><strong>{label}</strong><span>{detail}</span>{target === value && <Check size={16}/>}</label>)}</div></fieldset>
    <fieldset className="export-options format-fieldset"><legend>파일 형식</legend><div className="format-options">{[['png', 'PNG', '또렷한 글자와 선'], ['jpeg', 'JPEG', '작은 파일 크기']].map(([value, label, detail]) => <label className={format === value ? 'chosen' : ''} key={value}><input disabled={busy} type="radio" name="format" value={value} checked={format === value} onChange={() => options(setFormat, value)}/><strong>{label}</strong><span>{detail}</span>{format === value && <Check size={16}/>}</label>)}</div></fieldset>
    <label className="resolution-label">이미지 크기<select disabled={busy} aria-label="이미지 크기" value={scale} onChange={e => options(setScale, Number(e.target.value))}><option value="1">{Math.round(doc.width)} × {Math.round(doc.height)} px</option><option value="2">{Math.round(doc.width * 2)} × {Math.round(doc.height * 2)} px · 고해상도</option></select></label>
    <p className="fine-print">규격 {Number((doc.width / PIXELS_PER_MM).toFixed(1))} × {Number((doc.height / PIXELS_PER_MM).toFixed(1))} mm · RGB 이미지</p>
    <button className="button primary full export-submit" onClick={() => save()} disabled={busy}>{busy ? <Loader2 className="spin"/> : desktop ? <FolderCheck/> : <Download/>}{busy ? '이미지 저장 중…' : `${format.toUpperCase()} ${desktop ? '작업 폴더에 저장' : '다운로드'}`}</button>
    <p className="export-status" role="status">{message}</p>
    {results.length > 0 && <ul className="saved-files">{results.map(item => fileResult(item))}</ul>}
    {results.some(item => item.status === 'failed') && <button className="button full" disabled={busy} onClick={() => save(true)}>실패한 면 다시 저장</button>}
    {desktop && <p className="fine-print export-explanation">표시한 경로는 작업 폴더에 저장된 원본의 위치예요. 복사본 다운로드의 완료 여부와 위치는 브라우저에서 확인해주세요.</p>}
    {recent.length > 0 && <details className="recent-exports"><summary>이 작업 폴더에서 최근 저장한 파일</summary><ul className="saved-files">{recent.map(item => fileResult(item))}</ul></details>}
  </Dialog>;
}
