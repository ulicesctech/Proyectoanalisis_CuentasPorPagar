import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CXP_ENTITIES, getCxpEntity, type BandejaProceso, type CxpResource } from '@erp/contracts';
import { Select } from '../../shared/ui-kit';
import { CxpTopBar } from './components/CxpTopBar';
import { CxpBackToMenu } from './components/CxpBackToMenu';
import { CxpSidebar } from './components/CxpSidebar';
import { X } from 'lucide-react';
import './cxp.css';
const SHOW_SECTION_NAVIGATION = false;

/** Grupos cuyas pantallas se abren desde la página de inicio /cxp y no muestran sub-pestañas. */
const HOME_GROUPS = ['Configuración'];

/**
 * Pantallas con flujo propio que no pertenecen al CRUD genérico, en el orden del flujo:
 * las reglas tributarias se configuran antes de registrar, revisar y aprobar facturas.
 */
export const CXP_SCREENS = [
  { path: 'reglas-tributarias', title: 'Reglas tributarias', group: 'Facturas especiales' },
  { path: 'facturas-especiales', title: 'Facturas especiales', group: 'Facturas especiales' },
  { path: 'facturas-especiales/revision', title: 'Revisión y aprobación', group: 'Facturas especiales' },
  { path: 'reportes', title: 'Resumen', group: 'Reportes' },
  { path: 'reportes/antiguedad', title: 'Antigüedad de saldos', group: 'Reportes' },
  { path: 'reportes/retenciones', title: 'Retenciones', group: 'Reportes' },
  { path: 'reportes/estadistica', title: 'Estadística de compras', group: 'Reportes' },
] as const;
export type CxpScreen = (typeof CXP_SCREENS)[number]['path'];

const screens = [
  ...CXP_ENTITIES.map(item => ({ path: item.resource as string, title: item.title, group: item.group })),
  ...CXP_SCREENS,
];

/** Sin resource ni screen se renderiza como página de inicio (sin sub-pestañas). */
export function CxpLayout({ resource, screen, children, bandeja, searchQuery, onSearchChange, menuAccess = true }: {
  resource?: CxpResource; screen?: CxpScreen; children: ReactNode; bandeja?: BandejaProceso;
  searchQuery?: string; onSearchChange?: (value: string) => void;
  menuAccess?: boolean;
}) {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const mobileRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileMenu) return;
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    mobileRef.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileMenu(false); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(mobileRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? []).filter(el => el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if (event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',key);
    return () => {document.removeEventListener('keydown',key);document.body.style.overflow=previous;opener?.focus();};
  },[mobileMenu]);
  const { pathname } = useLocation();
  const mainPage = !!(resource || screen) && [ `/cxp/${resource ?? screen}`, `/cxp/${resource}/registros` ].includes(pathname);
  const active = bandeja ?? resource ?? screen;
  const group = resource ? getCxpEntity(resource)!.group : screen ? CXP_SCREENS.find(item => item.path === screen)!.group : undefined;
  const navigation = !group || HOME_GROUPS.includes(group) ? [] : group === 'Pagos'
    ? [
      { path: 'contrasenas', title: 'Contraseñas' },
      { path: 'autorizaciones', title: 'Autorizaciones' },
      { path: 'pagos', title: 'Pagos' },
      { path: 'cheques', title: 'Ejecución de pago' },
      ...screens.filter(item => item.group === 'Pagos' && item.path !== 'pagos'),
    ]
    : screens.filter(item => item.group === group);
  return <div className={`cxp-shell ${group === 'Pagos' ? 'cxp-payments-shell' : ''} flex h-screen w-screen overflow-hidden bg-slate-50`}>
    <CxpSidebar />
    {mobileMenu && createPortal(<div className="fixed inset-0 z-[9999] bg-slate-950/40" onMouseDown={event => {if(event.target===event.currentTarget)setMobileMenu(false);}}>
      <section ref={mobileRef} role="dialog" aria-modal="true" aria-label="Menú de Cuentas por pagar" className="cxp-mobile-menu relative h-dvh w-72 max-w-full bg-slate-900">
        <button aria-label="Cerrar menú" title="Cerrar menú" className="absolute right-3 top-4 z-10 rounded p-2 text-slate-300 hover:bg-slate-800" onClick={() => setMobileMenu(false)}><X size={20}/></button>
        <CxpSidebar mobile onNavigate={() => setMobileMenu(false)} />
      </section>
    </div>,document.body)}
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <CxpTopBar searchQuery={searchQuery} onSearchChange={onSearchChange} onOpenMenu={() => setMobileMenu(true)} />
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {menuAccess && mainPage && !bandeja && <div className="mb-4"><CxpBackToMenu /></div>}
        {SHOW_SECTION_NAVIGATION && navigation.length > 0 && <>
          {group !== 'Pagos' && <div className="cxp-mobile-navigation mb-4">
            <Select label="Pantalla" value={active}
              options={navigation.map(item => ({ value: item.path, label: item.title }))}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => navigate(`/cxp/${event.target.value}`)} />
          </div>}
          {group !== 'Pagos' && <div className="flex flex-wrap gap-2 mb-6" aria-label="Pantallas de cuentas por pagar">
            {navigation.map(item => <Link key={item.path} to={`/cxp/${item.path}`}
              aria-current={active === item.path ? 'page' : undefined}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors ${active === item.path ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{item.title}</Link>)}
          </div>}
        </>}
        {children}
      </main>
    </div>
  </div>;
}
