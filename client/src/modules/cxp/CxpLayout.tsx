import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CXP_ENTITIES, getCxpEntity, type CxpResource } from '@erp/contracts';
import { AppLayout, Select } from '../../shared/ui-kit';
import './cxp.css';

const groups = ['Configuración', 'Documentos', 'Facturas especiales', 'Pagos', 'Control', 'Conciliaciones'];

/** Pantallas de CXP que no son un CRUD genérico de CXP_ENTITIES (tienen flujo propio). */
export const CXP_SCREENS = [
  { path: 'facturas-especiales', title: 'Facturas especiales', group: 'Facturas especiales' },
  { path: 'facturas-especiales/revision', title: 'Revisión y aprobación', group: 'Facturas especiales' },
  { path: 'reglas-tributarias', title: 'Reglas tributarias', group: 'Facturas especiales' },
] as const;
export type CxpScreen = (typeof CXP_SCREENS)[number]['path'];

const screens = [
  ...CXP_ENTITIES.map(item => ({ path: item.resource as string, title: item.title, group: item.group })),
  ...CXP_SCREENS,
];

export function CxpLayout({ resource, screen, children }: { resource?: CxpResource; screen?: CxpScreen; children: ReactNode }) {
  const navigate = useNavigate();
  const active = resource ?? screen!;
  const group = (resource ? getCxpEntity(resource)!.group : CXP_SCREENS.find(item => item.path === screen)!.group);
  return <div className="cxp-shell">
    <AppLayout activeModule="cuentas_pagar" user={{ name: 'Equipo Cuentas por Pagar', role: 'ERP universitario', initials: 'CP' }}
      onSelectModule={(module: string) => navigate(module === 'cuentas_pagar' ? '/cxp' : module === 'cuentas_cobrar' ? '/cxc/organizacion/empresas' : '/')}
      tabs={groups.map(item => ({ id: item, label: item }))} activeTab={group}
      onTabChange={(tab: string) => navigate(`/cxp/${screens.find(item => item.group === tab)!.path}`)}>
      <div className="cxp-mobile-navigation mb-4"><Select label="Pantalla" value={active}
        options={screens.map(item => ({ value: item.path, label: `${item.group} · ${item.title}` }))}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => navigate(`/cxp/${event.target.value}`)} /></div>
      <div className="flex flex-wrap gap-2 mb-6" aria-label="Pantallas de cuentas por pagar">
        {screens.filter(item => item.group === group).map(item => <Link key={item.path} to={`/cxp/${item.path}`}
          aria-current={active === item.path ? 'page' : undefined}
          className={`px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors ${active === item.path ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{item.title}</Link>)}
      </div>
      {children}
    </AppLayout>
  </div>;
}
