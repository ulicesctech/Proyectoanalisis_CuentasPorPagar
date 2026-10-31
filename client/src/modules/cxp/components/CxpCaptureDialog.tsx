import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CxpButton } from './CxpButton';
import '../procesos/procesos.css';

/** Ventana de captura local a CXP; el cierre lo decide el formulario mediante onClose. */
export function CxpCaptureDialog({ title, description, onClose, children, busy = false }: {
  title: string; description: string; onClose: () => void; children: ReactNode; busy?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (document.querySelector('[data-cxp-confirm]')) return;
      if (document.querySelector('[data-provider-dialog]')) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]') ?? [])
        .filter(el => !el.matches(':disabled') && el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); document.body.style.overflow = previous; opener?.focus(); };
  }, []);
  return createPortal(<div className="cxp-process-page fixed inset-0 z-[9997] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[1px]"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="cxp-process-dialog cxp-create-dialog">
      <header className="cxp-dialog-heading"><div><h2>{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
        <CxpButton variant="secondary" icon={X} onClick={onClose} disabled={busy}>Cerrar</CxpButton>
      </header>
      <div className="cxp-dialog-body">{children}</div>
    </section>
  </div>, document.body);
}
