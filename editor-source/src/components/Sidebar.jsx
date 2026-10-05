import { Plus, Upload, Sparkles, Loader2, Check, X } from 'lucide-react';
import { TEMPLATES, templateBackground } from '../editor/model.js';
import BackgroundThumb from './BackgroundThumb.jsx';
export default function Sidebar({ tab, setTab, doc, selected, onSelect, onText, onAdd, onDelete, onBackground, prompt, setPrompt, onGenerate, generating, onUpload, mode }) {
  return <aside className="sidebar">
    <div className="sidebar-tabs" role="tablist" aria-label="편집 항목">{[['text', '텍스트'], ['background', '배경']].map(([value, text]) => <button key={value} role="tab" id={`${value}-tab`} aria-selected={tab === value} aria-controls="sidebar-panel" className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{text}</button>)}</div>
    <div className="sidebar-content" id="sidebar-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      {tab === 'text' ? <>
        <h2>명함에 담을 정보</h2>
        <div className="text-fields">{doc.layers.map(layer => <div className={`text-field ${selected === layer.id ? 'focused-field' : ''}`} key={layer.id}>
          <div className="field-label"><label htmlFor={`layer-${layer.id}`}>{layer.label}</label>{layer.field === 'custom' && <button className="field-delete" aria-label={`${layer.label} 삭제`} onClick={() => onDelete(layer.id)}><X size={13}/></button>}</div><input id={`layer-${layer.id}`} aria-label={layer.label} value={layer.text} maxLength={500} placeholder={`${layer.label} 입력`} onFocus={() => onSelect(layer.id)} onChange={event => onText(layer.id, event.target.value)}/>
        </div>)}</div>
        <button className="button add-text" onClick={onAdd} disabled={doc.layers.length >= 24}><Plus/>텍스트 추가</button>
        <p className="sidebar-tip">명함의 글자를 선택해 서식을 바꾸세요.<br/>방향키로 조금씩 이동할 수도 있어요.</p>
      </> : <>
        <h2>명함의 첫인상</h2><p className="panel-description">글자 없이, 배경만 바꿔보세요.</p>
        <div className="background-list">{TEMPLATES.map(template => <button className={`background-option ${doc.background.id === template.id ? 'active' : ''}`} key={template.id} onClick={() => onBackground(templateBackground(template))}><BackgroundThumb background={templateBackground(template)}/><span><strong>{template.label}</strong><small>{template.description}</small></span>{doc.background.id === template.id && <Check size={16}/>}</button>)}</div>
        <div className="generation-form"><label htmlFor="background-prompt">어떤 분위기를 원하세요?</label><textarea id="background-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={500} rows="3" placeholder="예: 세이지 컬러, 부드러운 곡선, 넉넉한 여백"/><button className="button primary full" onClick={onGenerate} disabled={generating || !prompt.trim()}>{generating ? <Loader2 className="spin"/> : <Sparkles/>}{generating ? '배경 준비 중…' : mode === 'desktop' ? 'ChatGPT에 배경 요청' : mode === 'mock' ? '배경 변형 보기' : '새 배경 만들기'}</button><p className="fine-print">{mode === 'desktop' ? '요청 문장을 채팅에 보내면 새 배경 시안을 받을 수 있어요.' : mode === 'mock' ? '페이퍼·미드나이트·세이지 배경의 변형을 골라보세요.' : '원하는 분위기로 배경을 만들어요.'}</p></div>
        <div className="upload-area"><label className="button upload-button"><Upload/>내 배경 이미지 넣기<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload}/></label><p className="fine-print">PNG, JPEG, WebP<br/>큰 이미지는 편집 크기에 맞춰 조정해요.</p></div>
      </>}
    </div>
  </aside>;
}
