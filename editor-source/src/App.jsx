import { useEffect, useRef, useState } from 'react';
import { Download, CheckCircle2, Undo2, Redo2, Sparkles, MousePointer2, Loader2 } from 'lucide-react';
import { useDocument } from './editor/useDocument.js';
import { cleanLayer, mergeRefinement, resizeDocument, TEMPLATES, templateBackground } from './editor/model.js';
import { cardDataURL, loadImage } from './editor/render.js';
import { ai } from './ai/index.js';
import Sidebar from './components/Sidebar.jsx';
import FormatBar from './components/FormatBar.jsx';
import CardCanvas from './components/CardCanvas.jsx';
import BackgroundThumb from './components/BackgroundThumb.jsx';
import ReviewDialog from './components/ReviewDialog.jsx';
import ExportDialog from './components/ExportDialog.jsx';
import SizeControls from './components/SizeControls.jsx';
import ChatRequestDialog from './components/ChatRequestDialog.jsx';
import { useDesktopBridge } from './desktop/useDesktopBridge.js';

export default function App() {
  const { doc, change, mark, undo, redo, saveState, canUndo, canRedo } = useDocument();
  const [selected, setSelected] = useState('name'), [tab, setTab] = useState('text');
  const [prompt, setPrompt] = useState('미니멀한 종이 질감, 얇은 곡선, 넉넉한 여백');
  const [generating, setGenerating] = useState(false), [review, setReview] = useState(null), [exporting, setExporting] = useState(false), [toast, setToast] = useState('');
  const requestId = useRef(0);
  const [chatRequest, setChatRequest] = useState(null);
  const desktop = ai.mode === 'desktop';
  const bridge = useDesktopBridge({ enabled: desktop, doc, onNotice: setToast, onProposal: proposal => {
    requestId.current++; setChatRequest(null); setReview(proposal);
  } });
  const visibleSaveState = desktop ? bridge.saveState : saveState;
  const layer = doc.layers.find(l => l.id === selected);
  function updateLayer(id, update, record = true) {
    change(current => ({ ...current, layers: current.layers.map(l => l.id === id ? cleanLayer({ ...l, ...update }, current) : l) }), record);
  }
  function selectLayer(id) { setSelected(id); if (id) setTab('text'); }
  function editLayer(id) { selectLayer(id); requestAnimationFrame(() => { const input = document.getElementById(`layer-${id}`); input?.focus(); input?.select(); }); }
  function addText() {
    if (doc.layers.length >= 24) return;
    const id = crypto.randomUUID();
    const next = cleanLayer({ ...doc.layers[0], id, field: 'custom', label: `추가 문구 ${doc.layers.filter(l => l.field === 'custom').length + 1}`, text: '새 텍스트', x: doc.width * .32, y: doc.height * .47, width: doc.width * .51, fontSize: 16, fontWeight: 400, color: doc.background.ink || '#183e32', align: 'left', tracking: 0 }, doc);
    change(current => ({ ...current, layers: [...current.layers, next] })); setSelected(id); setTab('text');
  }
  function removeSelected() {
    removeLayer(selected);
  }
  function removeLayer(id) { change(current => ({ ...current, layers: current.layers.filter(l => l.id !== id) })); if (selected === id) setSelected(null); }
  function setBackground(background) {
    change(current => ({ ...current, background, layers: current.layers.map(l => l.color === current.background.ink ? { ...l, color: background.ink || l.color } : l) }));
  }
  function setSize(widthMm, heightMm) {
    try { change(current => resizeDocument(current, widthMm, heightMm)); setToast('규격을 바꿨어요. 글자를 드래그해 배치를 다듬어보세요.'); }
    catch (error) { setToast(error.message); }
  }
  async function generateBackground() {
    if (generating || !prompt.trim()) return;
    if (desktop) { await prepareChat(`에이블램 명함 스튜디오의 현재 규격에 맞는 텍스트 없는 명함 배경을 만들어줘. 분위기: ${prompt}. 이름과 연락처는 편집 가능한 글자로 유지하고, 새 배경을 편집기에 비교 시안으로 보내줘.`); return; }
    setGenerating(true);
    try {
      const background = await ai.generateBackground({ prompt, style: doc.background.id, variant: doc.background.variant || 0, width: doc.width, height: doc.height });
      if (!background || !['image', 'template'].includes(background.type) || (background.type === 'image' && !background.src)) throw new Error('배경 결과를 읽지 못했어요.');
      if (background.type === 'image') await loadImage(background.src);
      setBackground(background); setToast('새 배경을 적용했어요. 글자는 계속 수정할 수 있어요.');
    } catch (error) { setToast(error.message || '배경을 만들지 못했어요.'); }
    finally { setGenerating(false); }
  }
  async function uploadBackground(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setToast('PNG, JPEG 또는 WebP 이미지를 선택해주세요.'); return; }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url), canvas = document.createElement('canvas');
      const factor = Math.min(1, 2160 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * factor); canvas.height = Math.round(image.height * factor);
      const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setBackground({ id: 'upload', type: 'image', label: file.name, src: canvas.toDataURL('image/jpeg', .9), ink: doc.background.ink || '#183e32', color: '#ffffff' });
      setToast('배경 이미지를 적용했어요.');
    } catch { setToast('이미지를 열지 못했어요. 다른 이미지로 다시 시도해주세요.'); }
    finally { URL.revokeObjectURL(url); }
  }
  async function runRefinement(original, direction) {
    const id = ++requestId.current;
    setReview({ original, direction, draft: null, explanation: '', error: '', loading: true });
    try {
      const preview = await cardDataURL(original);
      const result = await ai.refineLayout({ document: original, preview, direction });
      if (requestId.current !== id) return;
      const draft = mergeRefinement(original, result);
      setReview({ original, direction, draft, explanation: result.explanation, error: '', loading: false });
    } catch (error) {
      if (requestId.current === id) setReview({ original, direction, draft: null, explanation: '', error: error.message || '배치를 정리하지 못했어요.', loading: false });
    }
  }
  async function prepareChat(message) {
    try { await bridge.prepare(); setChatRequest(message); }
    catch { setToast('채팅 연결을 준비하지 못했어요. 스튜디오를 다시 열어주세요.'); }
  }
  function openReview() {
    if (!doc.layers.some(l => l.text.trim())) { setToast('명함에 들어갈 글자를 먼저 입력해주세요.'); return; }
    if (desktop) { prepareChat('에이블램 명함 스튜디오의 현재 명함을 읽고, 문구와 배경은 유지하면서 타이포그래피와 배치를 정리해줘. 편집기에 비교 시안을 보내줘.'); return; }
    runRefinement(structuredClone(doc), 'tidy');
  }
  function closeReview() { requestId.current++; setReview(null); }
  function applyReview() {
    if (!review?.draft || review.loading) return;
    if (JSON.stringify(doc) !== JSON.stringify(review.original)) { setReview(null); setToast('명함이 변경됐어요. 현재 상태로 시안을 다시 요청해주세요.'); return; }
    change(review.draft); setReview(null); setToast('새 시안을 적용했어요. 글자를 선택해 계속 수정해보세요.');
  }
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    function keyboard(event) {
      if (review || exporting || chatRequest || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected && event.target.closest('.text-hit')) { event.preventDefault(); removeSelected(); }
    }
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [review, exporting, chatRequest, selected, undo, redo, change]);
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="/" aria-label="에이블램 명함 스튜디오"><span className="brand-mark"><i/><i/></span><strong>에이블램</strong><span className="brand-divider"/><span className="brand-title">명함 스튜디오</span></a>
      <input className="document-title" aria-label="명함 제목" value={doc.title} maxLength={60} onChange={event => change(current => ({ ...current, title: event.target.value }))}/>
      <div className="header-actions"><span className={`save-state ${visibleSaveState === 'error' ? 'error' : ''}`} role="status"><CheckCircle2/>{visibleSaveState === 'saved' ? '자동 저장됨' : visibleSaveState === 'saving' ? '저장 중…' : desktop ? '저장 연결 확인 필요' : '자동 저장 공간 부족'}</span><button className="button primary export-button" onClick={() => setExporting(true)}><Download/><span>이미지 저장</span></button></div>
    </header>
    <nav className="workflow-bar" aria-label="명함 제작 과정"><div className="steps"><button className={`step ${!review ? 'current' : ''}`} onClick={() => { closeReview(); setTab('text'); }}><span className="step-number">1</span>텍스트 편집</button><span className="step-line"/><button className={`step ${review ? 'current' : ''}`} onClick={openReview}><span className="step-number">2</span>배치 정리</button></div><div className="history-tools"><button className="icon-button" aria-label="실행 취소" title="실행 취소 (⌘/Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2/></button><button className="icon-button" aria-label="다시 실행" title="다시 실행 (⌘/Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}><Redo2/></button></div></nav>
    <div className="workspace">
      <Sidebar tab={tab} setTab={setTab} doc={doc} selected={selected} onSelect={selectLayer} onText={(id, text) => updateLayer(id, { text })} onAdd={addText} onDelete={removeLayer} onBackground={setBackground} prompt={prompt} setPrompt={setPrompt} onGenerate={generateBackground} generating={generating} onUpload={uploadBackground} mode={ai.mode}/>
      <main className="stage">
        <div className="stage-main"><FormatBar layer={layer} onChange={update => updateLayer(selected, update)} onDelete={removeSelected}/>
          <div className="canvas-heading"><span>앞면</span><SizeControls doc={doc} onResize={setSize}/></div>
          <div className="card-wrap" style={{ '--card-ratio': doc.width / doc.height }}><CardCanvas doc={doc} selected={selected} onSelect={selectLayer} onMove={updateLayer} onGestureStart={mark} onEdit={editLayer}/></div>
          <p className="canvas-tip"><MousePointer2/>글자를 클릭하고 드래그해 위치를 바꿔보세요</p>
        </div>
        <footer className="stage-footer"><div className="template-tray"><h2>배경 스타일</h2><div className="template-thumbnails">{TEMPLATES.map(template => <button key={template.id} className={doc.background.id === template.id ? 'selected-template' : ''} aria-label={`${template.label} 배경`} aria-pressed={doc.background.id === template.id} title={template.label} onClick={() => setBackground(templateBackground(template))}><BackgroundThumb background={templateBackground(template)}/></button>)}<button className="more-backgrounds" onClick={() => setTab('background')}>배경<br/>만들기</button></div></div>
          <div className="refine-action"><button className="button primary refine-button" onClick={openReview}><Sparkles/>{desktop ? 'ChatGPT로 배치 정리' : ai.mode === 'mock' ? '빠른 배치 정리' : 'AI로 배치 정리'}</button><p className="fine-print">{desktop ? bridge.status === 'offline' ? '스튜디오를 다시 열어 연결해주세요' : '채팅에 요청해 디자인을 다듬어요' : ai.mode === 'mock' ? '준비된 배치를 비교하고 골라보세요' : '새 시안을 비교하고 골라보세요'}</p></div>
        </footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><CheckCircle2/>{toast}</div>}
    {review && <ReviewDialog review={review} mode={ai.mode} onClose={closeReview} onDirection={direction => runRefinement(review.original, direction)} onApply={applyReview}/>}
    {exporting && <ExportDialog doc={doc} onClose={() => setExporting(false)}/>}
    {chatRequest && <ChatRequestDialog request={chatRequest} onClose={() => setChatRequest(null)}/>}
  </div>;
}
