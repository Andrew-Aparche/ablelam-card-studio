import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Dialog({ title, children, onClose, wide = false }) {
  const ref = useRef(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const focusable = [...ref.current.querySelectorAll('button:not(:disabled), input, select, textarea, [tabindex="0"]')].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={ref} className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header className="dialog-header"><h2>{title}</h2><button className="icon-button" aria-label="창 닫기" onClick={onClose}><X/></button></header>{children}</section></div>;
}
