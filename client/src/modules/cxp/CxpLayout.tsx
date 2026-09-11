import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CXP_ENTITIES, getCxpEntity, type CxpResource } from '@erp/contracts';
import { AppLayout, Select } from '../../shared/ui-kit';
import './cxp.css';

const groups = ['Configuración', 'Documentos', 'Pagos', 'Control', 'Conciliaciones'];

export function CxpLayout({ resource, children }: { resource: CxpResource; children: ReactNode }) {
  const navigate = useNavigate();
  const entity = getCxpEntity(resource)!;
  return <div className="cxp-shell">
    <AppLayout activeModule="cuentas_pagar" user={{ name: 'Equipo Cuentas por Pagar', role: 'ERP universitario', initials: 'CP' }}
      onSelectModule={(module: string) => navigate(module === 'cuentas_pagar' ? '/cxp' : module === 'cuentas_cobrar' ? '/cxc/organizacion/empresas' : '/')}
      tabs={groups.map(group => ({ id: group, label: group }))} activeTab={entity.group}
      onTabChange={(group: string) => navigate(`/cxp/${CXP_ENTITIES.find(item => item.group === group)!.resource}`)}>
      <div className="cxp-mobile-navigation mb-4"><Select label="Pantalla" value={resource}
        options={CXP_ENTITIES.map(item => ({ value: item.resource, label: `${item.group} · ${item.title}` }))}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => navigate(`/cxp/${event.target.value}`)} /></div>
      <div className="flex flex-wrap gap-2 mb-6" aria-label="Pantallas de cuentas por pagar">
        {CXP_ENTITIES.filter(item => item.group === entity.group).map(item => <Link key={item.resource} to={`/cxp/${item.resource}`}
          aria-current={resource === item.resource ? 'page' : undefined}
          className={`px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors ${resource === item.resource ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{item.title}</Link>)}
      </div>
      {children}
    </AppLayout>
  </div>;
}
