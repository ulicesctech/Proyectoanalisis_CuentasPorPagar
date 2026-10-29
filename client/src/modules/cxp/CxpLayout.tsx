import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CXP_ENTITIES, getCxpEntity, type BandejaProceso, type CxpResource } from '@erp/contracts';
import { Select, Sidebar } from '../../shared/ui-kit';
import { CxpTopBar } from './components/CxpTopBar';
import { useOperador } from './operador/operador';
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
export function CxpLayout({ resource, screen, children, bandeja, searchQuery, onSearchChange }: {
  resource?: CxpResource; screen?: CxpScreen; children: ReactNode; bandeja?: BandejaProceso;
  searchQuery?: string; onSearchChange?: (value: string) => void;
}) {
  const navigate = useNavigate();
  const { actor } = useOperador();
  // El Sidebar es de solo lectura (components/ui): solo muestra con qué usuario se opera.
  const sidebarUser = actor
    ? { name: actor.nombre, role: 'Usuario operativo', initials: actor.nombre.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || 'CP' }
    : { name: 'Sin usuario operativo', role: 'Elige "Operando como"', initials: 'CP' };
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
    <Sidebar activeModule="cuentas_pagar" user={sidebarUser}
      onSelectModule={(module: string) => navigate(module === 'cuentas_pagar' ? '/cxp' : module === 'cuentas_cobrar' ? '/cxc/organizacion/empresas' : '/')} />
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <CxpTopBar searchQuery={searchQuery} onSearchChange={onSearchChange} />
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
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
