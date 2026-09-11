import { Router } from 'express';
import { listCxpOptions } from '../repositories/catalogos.repository';
import { cxpStringQuery } from '../controllers/crud.controller';
import parametroRoutes from './configuracion/parametro.routes';
import periodoRoutes from './configuracion/periodo.routes';
import cuentaBancariaRoutes from './configuracion/cuentaBancaria.routes';
import compromisoRoutes from './configuracion/compromiso.routes';
import documentoRoutes from './documentos/documento.routes';
import documentoDetalleRoutes from './documentos/documentoDetalle.routes';
import documentoTributoRoutes from './documentos/documentoTributo.routes';
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

const router = Router();

router.get('/catalogos/:catalog', async (req, res, next) => {
  try {
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

export default router;
