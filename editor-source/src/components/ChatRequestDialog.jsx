import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Dialog from './Dialog.jsx';

export default function ChatRequestDialog({ request, onClose }) {
  const [message, setMessage] = useState('');
  return <Dialog title="ChatGPT에 디자인 요청" onClose={onClose}>
    <p className="dialog-description">아래 문장을 복사해 옆 채팅에 보내주세요.<br/>완성된 시안은 이 편집기에서 비교하고 선택할 수 있어요.</p>
    <label className="chat-request-label">요청 내용<textarea readOnly value={request} aria-label="ChatGPT에 보낼 요청" onFocus={event => event.target.select()}/></label>
    <button className="button primary full" onClick={async () => {
      try { await navigator.clipboard.writeText(request); setMessage('복사했어요. 옆 채팅에 붙여넣고 보내주세요.'); }
      catch { setMessage('문장을 선택해서 직접 복사해주세요.'); }
    }}>{message.startsWith('복사') ? <Check/> : <Copy/>}요청 문장 복사</button>
    <p className="export-status" role="status">{message}</p>
    <p className="fine-print">이 버튼은 채팅을 자동으로 시작하지 않아요.</p>
  </Dialog>;
}
