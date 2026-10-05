import { AlignLeft, AlignCenter, Type, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { SIDE_LABELS } from '../editor/model.js';
import Dialog from './Dialog.jsx';
import CardCanvas from './CardCanvas.jsx';
export default function ReviewDialog({ review, onClose, onDirection, onApply, mode, busy }) {
  return <Dialog title={review.kind === 'background' ? 'ChatGPT 배경 시안' : mode === 'desktop' ? 'ChatGPT 배치 시안' : mode === 'mock' ? '빠른 배치 정리' : 'AI로 배치 정리'} onClose={() => { if (!busy) onClose(); }} wide>
    <p className="dialog-description"><strong>{SIDE_LABELS[review.face || 'front']} 시안 · </strong>{review.kind === 'background' ? '글자를 그대로 두고 새로운 배경을 비교해보세요.' : '문구와 배경은 유지하고, 글자의 크기와 간격을 정리해요.'}</p>
    {mode !== 'desktop' && <div className="direction-options" role="group" aria-label="배치 스타일">{[['tidy', AlignLeft, '단정하게'], ['center', AlignCenter, '중앙으로'], ['editorial', Type, '이름을 강조']].map(([value, Icon, label]) => <button key={value} className={`button ${review.direction === value ? 'chosen' : ''}`} onClick={() => onDirection(value)} disabled={review.loading}><Icon/>{label}</button>)}</div>}
    <div className="review-cards"><div><h3>현재 명함</h3><CardCanvas doc={review.original} readOnly/></div><ArrowRight className="review-arrow"/><div><h3>{mode === 'mock' ? '추천 배치' : 'AI가 정리한 시안'}<span className="demo-label">{mode === 'mock' ? '배치 예시' : 'AI'}</span></h3><div className="preview-wrap"><CardCanvas doc={review.draft || review.original} readOnly/>{review.loading && <div className="preview-loading"><Loader2 className="spin"/><span>글자의 균형을 맞추고 있어요</span></div>}</div></div></div>
    <div className="review-message" role="status">{review.error || (review.loading ? '잠시만 기다려주세요.' : review.explanation)}</div>
    <footer className="dialog-footer"><span className="fine-print">적용한 뒤에도 직접 수정할 수 있어요.</span><div><button className="button" onClick={onClose} disabled={busy}>현재 명함 유지</button><button className="button primary" onClick={onApply} disabled={busy || review.loading || !review.draft}><Sparkles/>{busy ? '적용 내용 저장 중…' : '이 시안 적용'}</button></div></footer>
  </Dialog>;
}
