// client/src/app/routes.tsx
// Configuración de rutas para el ERP Universitario
import { Navigate, type RouteObject } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { cxpRoutes } from '../modules/cxp/routes';

// --- CXC / Organización ---
import { OrganizacionLayout } from '../modules/cxc/organizacion/OrganizacionLayout';
import { EmpresasPage } from '../modules/cxc/organizacion/EmpresasPage';
import { SucursalesPage } from '../modules/cxc/organizacion/SucursalesPage';
import { RutasPage } from '../modules/cxc/organizacion/RutasPage';
import { RutaDetallePage } from '../modules/cxc/organizacion/RutaDetallePage';

// --- CXC / Cobranza ---
import { CobranzaLayout } from '../modules/cxc/cobranza/CobranzaLayout';
import { GestionesCobroPage } from '../modules/cxc/cobranza/GestionesCobroPage';
import { PromesasPagoPage } from '../modules/cxc/cobranza/PromesasPagoPage';
import { ConveniosPagoPage } from '../modules/cxc/cobranza/ConveniosPagoPage';
import { ConvenioDetallePage } from '../modules/cxc/cobranza/ConvenioDetallePage';

// --- CXC / Crédito ---
import { CreditoLayout } from '../modules/cxc/credito/CreditoLayout';
import { CondicionesCreditoPage } from '../modules/cxc/credito/CondicionesCreditoPage';
import { NotasCreditoPage } from '../modules/cxc/credito/NotasCreditoPage';
import { AplicacionesNotaCreditoPage } from '../modules/cxc/credito/AplicacionesNotaCreditoPage';
import { MoraPage } from '../modules/cxc/credito/MoraPage';

// --- CXC / Pagos ---
import { PagosLayout } from '../modules/cxc/pagos/PagosLayout';
import { PagosPage } from '../modules/cxc/pagos/PagosPage';
import { AplicacionesPagoPage } from '../modules/cxc/pagos/AplicacionesPagoPage';
import { AnticiposPage } from '../modules/cxc/pagos/AnticiposPage';
import { RecibosPage } from '../modules/cxc/pagos/RecibosPage';
import { FormasPagoPage } from '../modules/cxc/pagos/FormasPagoPage';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/cxp" replace /> },

  ...cxpRoutes,

  // --- CXC / Organización ---
  {
    path: '/cxc/organizacion/empresas',
    element: (
      <MainLayout>
        <OrganizacionLayout>
          <EmpresasPage />
        </OrganizacionLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/organizacion/sucursales',
    element: (
      <MainLayout>
        <OrganizacionLayout>
          <SucursalesPage />
        </OrganizacionLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/organizacion/rutas',
    element: (
      <MainLayout>
        <OrganizacionLayout>
          <RutasPage />
        </OrganizacionLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/organizacion/rutas/:id',
    element: (
      <MainLayout>
        <OrganizacionLayout>
          <RutaDetallePage />
        </OrganizacionLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Cobranza ---
  {
    path: '/cxc/cobranza/gestiones-cobro',
    element: (
      <MainLayout>
        <CobranzaLayout>
          <GestionesCobroPage />
        </CobranzaLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/cobranza/promesas-pago',
    element: (
      <MainLayout>
        <CobranzaLayout>
          <PromesasPagoPage />
        </CobranzaLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/cobranza/convenios-pago',
    element: (
      <MainLayout>
        <CobranzaLayout>
          <ConveniosPagoPage />
        </CobranzaLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/cobranza/convenios-pago/:id',
    element: (
      <MainLayout>
        <CobranzaLayout>
          <ConvenioDetallePage />
        </CobranzaLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Crédito ---
  {
    path: '/cxc/credito/condiciones-credito',
    element: (
      <MainLayout>
        <CreditoLayout>
          <CondicionesCreditoPage />
        </CreditoLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/credito/notas-credito',
    element: (
      <MainLayout>
        <CreditoLayout>
          <NotasCreditoPage />
        </CreditoLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/credito/aplicaciones-nota-credito',
    element: (
      <MainLayout>
        <CreditoLayout>
          <AplicacionesNotaCreditoPage />
        </CreditoLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/credito/mora',
    element: (
      <MainLayout>
        <CreditoLayout>
          <MoraPage />
        </CreditoLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Pagos ---
  {
    path: '/cxc/pagos/pagos',
    element: (
      <MainLayout>
        <PagosLayout>
          <PagosPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/aplicaciones-pago',
    element: (
      <MainLayout>
        <PagosLayout>
          <AplicacionesPagoPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/anticipos',
    element: (
      <MainLayout>
        <PagosLayout>
          <AnticiposPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/recibos',
    element: (
      <MainLayout>
        <PagosLayout>
          <RecibosPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/formas-pago',
    element: (
      <MainLayout>
        <PagosLayout>
          <FormasPagoPage />
        </PagosLayout>
      </MainLayout>
    ),
  },

  // Cualquier ruta no reconocida cae aquí en vez de mostrar el 404 por defecto de react-router.
  { path: '*', element: <Navigate to="/cxp" replace /> },
];