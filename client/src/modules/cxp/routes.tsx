// client/src/modules/cxp/routes.tsx
import { Navigate, type RouteObject } from 'react-router-dom';

// --- Configuración ---
import { CxpParametroPage } from './configuracion/ParametroPage';
import { CxpPeriodoPage } from './configuracion/PeriodoPage';
import { CxpCuentaBancariaPage } from './configuracion/CuentaBancariaPage';
import { CxpCompromisoPage } from './configuracion/CompromisoPage';

// --- Documentos ---
import { CxpDocumentoPage } from './documentos/DocumentoPage';
import { CxpDocumentoDetallePage } from './documentos/DocumentoDetallePage';
import { CxpDocumentoTributoPage } from './documentos/DocumentoTributoPage';

// --- Facturas especiales y tributos ---
import { CxpFacturasEspecialesPage } from './facturas-especiales/FacturasEspecialesPage';
import { CxpFacturaEspecialDetallePage } from './facturas-especiales/FacturaEspecialDetallePage';
import { CxpRevisionAprobacionPage } from './facturas-especiales/RevisionAprobacionPage';
import { CxpReglasTributariasPage } from './facturas-especiales/ReglasTributariasPage';

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

export const cxpRoutes: RouteObject[] = [
  { path: '/cxp', element: <Navigate to="/cxp/parametros" replace /> },

  // --- Configuración ---
  { path: '/cxp/parametros', element: <CxpParametroPage /> },
  { path: '/cxp/periodos', element: <CxpPeriodoPage /> },
  { path: '/cxp/cuentas-bancarias', element: <CxpCuentaBancariaPage /> },
  { path: '/cxp/compromisos', element: <CxpCompromisoPage /> },

  // --- Documentos ---
  { path: '/cxp/documentos', element: <CxpDocumentoPage /> },
  { path: '/cxp/documentos-detalle', element: <CxpDocumentoDetallePage /> },
  { path: '/cxp/documentos-tributos', element: <CxpDocumentoTributoPage /> },

  // --- Facturas especiales y tributos ---
  { path: '/cxp/facturas-especiales', element: <CxpFacturasEspecialesPage /> },
  { path: '/cxp/facturas-especiales/revision', element: <CxpRevisionAprobacionPage /> },
  { path: '/cxp/facturas-especiales/:id', element: <CxpFacturaEspecialDetallePage /> },
  { path: '/cxp/reglas-tributarias', element: <CxpReglasTributariasPage /> },

  // --- Pagos ---
  { path: '/cxp/lotes-pago', element: <CxpLotePagoPage /> },
  { path: '/cxp/pagos', element: <CxpPagoPage /> },
  { path: '/cxp/aplicaciones', element: <CxpAplicacionPage /> },

  // --- Control ---
  { path: '/cxp/reglas-aprobacion', element: <CxpReglaAprobacionPage /> },
  { path: '/cxp/aprobaciones', element: <CxpAprobacionPage /> },
  { path: '/cxp/eventos', element: <CxpEventoPage /> },
  { path: '/cxp/archivos', element: <CxpArchivoPage /> },

  // --- Conciliaciones ---
  { path: '/cxp/conciliaciones-proveedor', element: <CxpConciliacionProveedorPage /> },
  { path: '/cxp/conciliaciones-proveedor-detalle', element: <CxpConciliacionProveedorDetallePage /> },
  { path: '/cxp/conciliaciones-pago', element: <CxpConciliacionPagoPage /> },
];