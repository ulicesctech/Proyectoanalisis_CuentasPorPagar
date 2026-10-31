import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CxpLayout } from '../CxpLayout';
import { buscarPantalla } from '../navegacion/pantallas';
import { HomePendientes } from './HomePendientes';
import { HomeRecientes } from './HomeRecientes';
import { ModuleCard } from './ModuleCard';
import { ModuleHeader } from './ModuleHeader';
import { ModuleSection } from './ModuleSection';
import { CXP_AREAS, CXP_CONFIGURACION } from './cxpHome.config';
import './home.css';

export function CxpHomePage() {
  return <CxpLayout>
    <div className="mx-auto max-w-7xl space-y-8">
      <ModuleHeader />
      <HomePendientes />
      <HomeRecientes />
      <ModuleSection id="areas" title="Áreas de trabajo" subtitle="Entra a un área o directamente a una de sus pantallas." orden={3}>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CXP_AREAS.map((area, indice) => <li key={area.id} className="cxp-home-reveal"
            style={{ '--i': 3 + indice * 0.5 } as CSSProperties}>
            <ModuleCard area={area} />
          </li>)}
        </ul>
      </ModuleSection>
      <ModuleSection id="configuracion" title="Configuración" subtitle="Catálogos y parámetros del módulo." orden={6}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {CXP_CONFIGURACION.map(({ path, description }) => {
            const pantalla = buscarPantalla(path);
            if (!pantalla) return null;
            const Icon = pantalla.icon;
            return <li key={path}>
              <Link to={path}
                className="cxp-home-lift group flex h-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 hover:border-slate-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors duration-150 group-hover:bg-slate-800 group-hover:text-white">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-medium text-slate-900">{pantalla.title}</span>
                  <span className="block truncate text-xs text-slate-500">{description}</span>
                </span>
              </Link>
            </li>;
          })}
        </ul>
      </ModuleSection>
    </div>
  </CxpLayout>;
}
