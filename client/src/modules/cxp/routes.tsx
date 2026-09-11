import { Navigate, type RouteObject } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { CxpParametroPage } from './configuracion/ParametroPage';
import { CxpPeriodoPage } from './configuracion/PeriodoPage';
import { CxpCuentaBancariaPage } from './configuracion/CuentaBancariaPage';
import { CxpCompromisoPage } from './configuracion/CompromisoPage';
import { CxpDocumentoPage } from './documentos/DocumentoPage';
import { CxpDocumentoDetallePage } from './documentos/DocumentoDetallePage';
import { CxpDocumentoTributoPage } from './documentos/DocumentoTributoPage';
import { CxpLotePagoPage } from './pagos/LotePagoPage';
import { CxpPagoPage } from './pagos/PagoPage';
import { CxpAplicacionPage } from './pagos/AplicacionPage';
import { CxpReglaAprobacionPage } from './control/ReglaAprobacionPage';
import { CxpAprobacionPage } from './control/AprobacionPage';
import { CxpConciliacionProveedorPage } from './conciliaciones/ConciliacionProveedorPage';
import { CxpConciliacionProveedorDetallePage } from './conciliaciones/ConciliacionProveedorDetallePage';
import { CxpConciliacionPagoPage } from './conciliaciones/ConciliacionPagoPage';
import { CxpEventoPage } from './control/EventoPage';
import { CxpArchivoPage } from './control/ArchivoPage';

export const cxpRoutes: RouteObject[] = [
  { path: '/cxp', element: <Navigate to="/cxp/parametros" replace /> },
  { path: '/cxp/parametros', element: <MainLayout><CxpParametroPage /></MainLayout> },
  { path: '/cxp/periodos', element: <MainLayout><CxpPeriodoPage /></MainLayout> },
  { path: '/cxp/cuentas-bancarias', element: <MainLayout><CxpCuentaBancariaPage /></MainLayout> },
  { path: '/cxp/compromisos', element: <MainLayout><CxpCompromisoPage /></MainLayout> },
  { path: '/cxp/documentos', element: <MainLayout><CxpDocumentoPage /></MainLayout> },
  { path: '/cxp/documentos-detalle', element: <MainLayout><CxpDocumentoDetallePage /></MainLayout> },
  { path: '/cxp/documentos-tributos', element: <MainLayout><CxpDocumentoTributoPage /></MainLayout> },
  { path: '/cxp/lotes-pago', element: <MainLayout><CxpLotePagoPage /></MainLayout> },
  { path: '/cxp/pagos', element: <MainLayout><CxpPagoPage /></MainLayout> },
  { path: '/cxp/aplicaciones', element: <MainLayout><CxpAplicacionPage /></MainLayout> },
  { path: '/cxp/reglas-aprobacion', element: <MainLayout><CxpReglaAprobacionPage /></MainLayout> },
  { path: '/cxp/aprobaciones', element: <MainLayout><CxpAprobacionPage /></MainLayout> },
  { path: '/cxp/conciliaciones-proveedor', element: <MainLayout><CxpConciliacionProveedorPage /></MainLayout> },
  { path: '/cxp/conciliaciones-proveedor-detalle', element: <MainLayout><CxpConciliacionProveedorDetallePage /></MainLayout> },
  { path: '/cxp/conciliaciones-pago', element: <MainLayout><CxpConciliacionPagoPage /></MainLayout> },
  { path: '/cxp/eventos', element: <MainLayout><CxpEventoPage /></MainLayout> },
  { path: '/cxp/archivos', element: <MainLayout><CxpArchivoPage /></MainLayout> },
];
