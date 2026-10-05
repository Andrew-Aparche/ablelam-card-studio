import { AlignLeft, AlignCenter, AlignRight, Bold, Trash2 } from 'lucide-react';
import { FONTS } from '../editor/model.js';
export default function FormatBar({ layer, onChange, onDelete }) {
  return <div className={`format-bar ${!layer ? 'inactive' : ''}`} aria-label="텍스트 서식 도구">
    {!layer ? <span className="format-hint">명함에서 글자를 선택하면 서식을 바꿀 수 있어요</span> : <>
      <label className="sr-only" htmlFor="font-family">글꼴</label>
      <select id="font-family" value={layer.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })}>{FONTS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}</select>
      <label className="size-field" title="글자 크기"><input key={`${layer.id}-${layer.fontSize}`} type="number" aria-label="글자 크기" defaultValue={layer.fontSize} min="6" max="72" onBlur={e => onChange({ fontSize: Number(e.target.value) || layer.fontSize })} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></label>
      <span className="tool-separator"/>
      <button className={`icon-button ${layer.fontWeight === 700 ? 'active' : ''}`} aria-label="굵게" aria-pressed={layer.fontWeight === 700} onClick={() => onChange({ fontWeight: layer.fontWeight === 700 ? 400 : 700 })}><Bold/></button>
      <div className="alignment-group">{[['left', AlignLeft, '왼쪽 정렬'], ['center', AlignCenter, '가운데 정렬'], ['right', AlignRight, '오른쪽 정렬']].map(([align, Icon, title]) => <button key={align} className={`icon-button ${layer.align === align ? 'active' : ''}`} aria-label={title} aria-pressed={layer.align === align} onClick={() => onChange({ align })}><Icon/></button>)}</div>
      <label className="color-control" title="글자 색상"><input type="color" aria-label="글자 색상" value={layer.color} onChange={e => onChange({ color: e.target.value })}/></label>
      <label className="tracking-field" title="글자 간격"><span>자간</span><input key={`${layer.id}-tracking-${layer.tracking}`} type="number" aria-label="글자 간격" defaultValue={layer.tracking} step="0.2" min="-1" max="5" onBlur={e => onChange({ tracking: Number(e.target.value) || 0 })}/></label>
      <span className="tool-separator"/><button className="icon-button delete-button" aria-label="선택한 텍스트 삭제" onClick={onDelete}><Trash2/></button>
    </>}
  </div>;
}
