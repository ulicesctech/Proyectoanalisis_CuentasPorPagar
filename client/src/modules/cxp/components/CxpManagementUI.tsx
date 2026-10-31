import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { CxpResource } from '@erp/contracts';
import { CxpButton } from './CxpButton';
import './cxpManagement.css';

/** Presentación compartida solo por Control y Conciliaciones. */
export const CXP_MANAGEMENT_VIEWS = [
  { resource: 'reglas-aprobacion', group: 'Control', title: 'Reglas de aprobación', path: '/cxp/reglas-aprobacion',
    description: 'Configurá los importes, niveles y roles que intervienen en las aprobaciones.' },
  { resource: 'aprobaciones', group: 'Control', title: 'Aprobaciones', path: '/cxp/aprobaciones/registros',
    description: 'Consultá las solicitudes y decisiones registradas para cada operación.' },
  { resource: 'eventos', group: 'Control', title: 'Eventos', path: '/cxp/eventos',
    description: 'Consultá el seguimiento, los responsables y las fechas de las gestiones.' },
  { resource: 'archivos', group: 'Control', title: 'Archivos', path: '/cxp/archivos',
    description: 'Registrá la referencia y ubicación de los archivos de respaldo. Este formulario no carga archivos.' },
  { resource: 'conciliaciones-proveedor', group: 'Conciliaciones', title: 'Conciliaciones de proveedor', path: '/cxp/conciliaciones-proveedor',
    description: 'Compará el saldo de la empresa con el estado de cuenta del proveedor.' },
  { resource: 'conciliaciones-proveedor-detalle', group: 'Conciliaciones', title: 'Detalle de conciliaciones', path: '/cxp/conciliaciones-proveedor-detalle',
    description: 'Revisá los documentos y pagos relacionados y sus diferencias.' },
  { resource: 'conciliaciones-pago', group: 'Conciliaciones', title: 'Conciliaciones de pago', path: '/cxp/conciliaciones-pago',
    description: 'Compará los pagos registrados con sus movimientos y referencias bancarias.' },
] as const;

export function isCxpManagementResource(resource: CxpResource): boolean {
  return CXP_MANAGEMENT_VIEWS.some(view => view.resource === resource);
}

interface CxpManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  busy?: boolean;
  children: ReactNode;
}

/** Cabecera fija, foco contenido y cuerpo desplazable, sin modificar el modal del ERP. */
export function CxpManagementDialog({
  isOpen, onClose, title, description, size = 'lg', busy = false, children,
}: CxpManagementDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const current = useRef({ onClose, busy });
  current.current = { onClose, busy };

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => panel.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !panel.current) return;
      if(document.querySelector('[data-cxp-confirm]'))return;
      const dialogs=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(element=>element.getClientRects().length);
      if(dialogs[dialogs.length-1]!==panel.current)return;
      // Un diálogo anidado (p. ej., registro de proveedor) conserva su propio foco.
      if (panel.current.querySelector('[role="dialog"]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!current.current.busy) current.current.onClose();
      }
      if (event.key === 'Tab') {
        const controls = Array.from(panel.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        )).filter(element => !element.closest('[hidden]') && element.getAttribute('aria-hidden') !== 'true');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); panel.current.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return <div className="cxp-management-backdrop" onClick={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined} aria-busy={busy || undefined}
      tabIndex={-1} className={`cxp-management-dialog cxp-management-dialog--${size}`}>
      <header className="cxp-management-dialog-header">
        <div><p className="cxp-management-eyebrow">Cuentas por Pagar</p>
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descriptionId} className="cxp-management-description">{description}</p>}
        </div>
        <CxpButton icon={X} variant="secondary" disabled={busy} onClick={onClose}>Cerrar</CxpButton>
      </header>
      <div className="cxp-management-dialog-body">{children}</div>
    </div>
  </div>;
}
