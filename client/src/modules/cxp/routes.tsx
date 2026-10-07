import { ProcesosPagoPage } from './procesos/ProcesosPagoPage';
// client/src/modules/cxp/routes.tsx
import { Navigate, type RouteObject } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';

// --- Configuración ---
import { CxpParametroPage } from './configuracion/ParametroPage';
import { CxpPeriodoPage } from './configuracion/PeriodoPage';
import { CxpCuentaBancariaPage } from './configuracion/CuentaBancariaPage';
import { CxpCompromisoPage } from './configuracion/CompromisoPage';

// --- Documentos ---
import { CxpDocumentoPage } from './documentos/DocumentoPage';
import { CxpDocumentoRegistroPage } from './documentos/DocumentoRegistroPage';
import { CxpDocumentoExpedientePage } from './documentos/DocumentoExpedientePage';
import { CxpDocumentoDetallePage } from './documentos/DocumentoDetallePage';
import { CxpDocumentoTributoPage } from './documentos/DocumentoTributoPage';

// --- Pagos ---
import { CxpLotePagoPage } from './pagos/LotePagoPage';
import { CxpPagoPage } from './pagos/PagoPage';
import { CxpAplicacionPage } from './pagos/AplicacionPage';

// --- Control ---
import { CxpReglaAprobacionPage } from './control/ReglaAprobacionPage';
import { CxpAprobacionPage } from './control/AprobacionPage';
import { CxpEventoPage } from './control/EventoPage';
import { CxpArchivoPage } from './control/ArchivoPage';

// --- Conciliaciones ---
import { CxpConciliacionProveedorPage } from './conciliaciones/ConciliacionProveedorPage';
import { CxpConciliacionProveedorDetallePage } from './conciliaciones/ConciliacionProveedorDetallePage';
import { CxpConciliacionPagoPage } from './conciliaciones/ConciliacionPagoPage';

const cxpPages: RouteObject[] = [
  { path: '/cxp/procesos-pago', element: <Navigate to="/cxp/contrasenas" replace /> },
  { path: '/cxp/contrasenas', element: <ProcesosPagoPage key="contrasenas" bandeja="contrasenas" /> },
  { path: '/cxp/autorizaciones', element: <ProcesosPagoPage key="autorizaciones" bandeja="autorizaciones" /> },
  { path: '/cxp/cheques', element: <ProcesosPagoPage key="cheques" bandeja="cheques" /> },
  { path: '/cxp', element: <Navigate to="/cxp/parametros" replace /> },
  // --- Configuración ---
  { path: '/cxp/parametros', element: <CxpParametroPage /> },
  { path: '/cxp/periodos', element: <CxpPeriodoPage /> },
  { path: '/cxp/cuentas-bancarias', element: <CxpCuentaBancariaPage /> },
  { path: '/cxp/compromisos', element: <CxpCompromisoPage /> },

  // --- Documentos ---
  { path: '/cxp/documentos', element: <CxpDocumentoPage /> },
  { path: '/cxp/documentos/nuevo', element: <CxpDocumentoRegistroPage /> },
  { path: '/cxp/documentos/:id', element: <CxpDocumentoExpedientePage /> },
  { path: '/cxp/documentos-detalle', element: <CxpDocumentoDetallePage /> },
  { path: '/cxp/documentos-tributos', element: <CxpDocumentoTributoPage /> },

  // --- Pagos ---
  { path: '/cxp/lotes-pago', element: <CxpLotePagoPage /> },
  { path: '/cxp/pagos', element: <ProcesosPagoPage key="pagos" bandeja="pagos" /> },
  { path: '/cxp/pagos/registros', element: <CxpPagoPage /> },
  { path: '/cxp/aplicaciones', element: <CxpAplicacionPage /> },

  // --- Control ---
  { path: '/cxp/reglas-aprobacion', element: <CxpReglaAprobacionPage /> },
  { path: '/cxp/aprobaciones', element: <Navigate to="/cxp/autorizaciones" replace /> },
  { path: '/cxp/aprobaciones/registros', element: <CxpAprobacionPage /> },
  { path: '/cxp/eventos', element: <CxpEventoPage /> },
  { path: '/cxp/archivos', element: <CxpArchivoPage /> },

  // --- Conciliaciones ---
  { path: '/cxp/conciliaciones-proveedor', element: <CxpConciliacionProveedorPage /> },
  { path: '/cxp/conciliaciones-proveedor-detalle', element: <CxpConciliacionProveedorDetallePage /> },
  { path: '/cxp/conciliaciones-pago', element: <CxpConciliacionPagoPage /> },
];
export const cxpRoutes: RouteObject[] = cxpPages.map(route => ({
  ...route,
  element: <MainLayout>{route.element}</MainLayout>,
}));
