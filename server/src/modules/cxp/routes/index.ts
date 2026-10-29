import procesosRoutes from './procesos.routes';
import { Router } from 'express';
import { listCxpOptions } from '../repositories/catalogos.repository';
import { cxpStringQuery } from '../controllers/crud.controller';
import { exigirActor, listadoUsuariosDisponible, resolverActor } from '../services/identidad';
import { CxpError } from '../services/errors';
import parametroRoutes from './configuracion/parametro.routes';
import periodoRoutes from './configuracion/periodo.routes';
import cuentaBancariaRoutes from './configuracion/cuentaBancaria.routes';
import compromisoRoutes from './configuracion/compromiso.routes';
import documentoRoutes from './documentos/documento.routes';
import documentoDetalleRoutes from './documentos/documentoDetalle.routes';
import documentoTributoRoutes from './documentos/documentoTributo.routes';
import facturaEspecialRoutes from './documentos/facturaEspecial.routes';
import reglaTributariaRoutes from './documentos/reglaTributaria.routes';
import lotePagoRoutes from './pagos/lotePago.routes';
import pagoRoutes from './pagos/pago.routes';
import aplicacionRoutes from './pagos/aplicacion.routes';
import reglaAprobacionRoutes from './control/reglaAprobacion.routes';
import aprobacionRoutes from './control/aprobacion.routes';
import conciliacionProveedorRoutes from './conciliaciones/conciliacionProveedor.routes';
import conciliacionProveedorDetalleRoutes from './conciliaciones/conciliacionProveedorDetalle.routes';
import conciliacionPagoRoutes from './conciliaciones/conciliacionPago.routes';
import eventoRoutes from './control/evento.routes';
import archivoRoutes from './control/archivo.routes';
import proveedorRoutes from './configuracion/proveedor.routes';
import antiguedadRoutes from '../reports/antiguedad/antiguedad.routes';
import libroComprasRoutes from '../reports/libro-compras/libro-compras.routes';
import estadisticaRoutes from '../reports/estadistica/estadistica.routes';
import asisteComprasRoutes from '../reports/asiste-compras/asiste-compras.routes';
import retencionesRoutes from '../reports/retenciones/retenciones.routes';
import bitacoraRoutes from '../reports/bitacora/bitacora.routes';

const router = Router();
// Identidad única del módulo: resuelve X-CXP-Actor-Id (si viene) para todas las rutas.
router.use(resolverActor);
// Toda escritura requiere el usuario operativo; las vistas previas por POST no guardan nada.
const POST_SIN_ESCRITURA = new Set(['/documentos/calcular-vencimiento', '/facturas-especiales/calcular', '/proveedores/validar-nit']);
router.use((req, res, next) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || POST_SIN_ESCRITURA.has(req.path)
  ? next() : exigirActor(req, res, next)));
router.use('/procesos', procesosRoutes);

router.get('/catalogos/:catalog', async (req, res, next) => {
  try {
    if (req.params.catalog === 'usuarios' && !listadoUsuariosDisponible()) {
      throw new CxpError('Recurso no disponible', 404);
    }
    res.json(await listCxpOptions(req.params.catalog, {
      search: cxpStringQuery(req, 'search'), selected: cxpStringQuery(req, 'selected'),
      filterField: cxpStringQuery(req, 'filterField'), filterValue: cxpStringQuery(req, 'filterValue'),
    }));
  } catch (error) { next(error); }
});

router.use('/parametros', parametroRoutes);
router.use('/periodos', periodoRoutes);
router.use('/cuentas-bancarias', cuentaBancariaRoutes);
router.use('/compromisos', compromisoRoutes);
router.use('/documentos', documentoRoutes);
router.use('/documentos-detalle', documentoDetalleRoutes);
router.use('/documentos-tributos', documentoTributoRoutes);
router.use('/facturas-especiales', facturaEspecialRoutes);
router.use('/reglas-tributarias', reglaTributariaRoutes);
router.use('/lotes-pago', lotePagoRoutes);
router.use('/pagos', pagoRoutes);
router.use('/aplicaciones', aplicacionRoutes);
router.use('/reglas-aprobacion', reglaAprobacionRoutes);
router.use('/aprobaciones', aprobacionRoutes);
router.use('/conciliaciones-proveedor', conciliacionProveedorRoutes);
router.use('/conciliaciones-proveedor-detalle', conciliacionProveedorDetalleRoutes);
router.use('/conciliaciones-pago', conciliacionPagoRoutes);
router.use('/eventos', eventoRoutes);
router.use('/archivos', archivoRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/reportes', antiguedadRoutes);
router.use('/reportes', libroComprasRoutes);
router.use('/reportes', estadisticaRoutes);
router.use('/reportes', asisteComprasRoutes);
router.use('/reportes', retencionesRoutes);
router.use('/reportes', bitacoraRoutes);

export default router;
