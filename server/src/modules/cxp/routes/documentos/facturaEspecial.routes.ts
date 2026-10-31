import { Router } from 'express';
import { registerIdParams } from '../../../../shared';
import { cxpFacturaEspecialController as controller } from '../../controllers/documentos/facturaEspecial.controller';
import { facturaEspecialConfiguracion } from '../../services/documentos/facturaEspecial.configuracion';

const router = Router();
registerIdParams(router);

router.get('/', controller.list);
router.get('/configuracion', async (req,res,next) => {
  try {res.json(await facturaEspecialConfiguracion(typeof req.query.fechaDocumento==='string'?req.query.fechaDocumento:undefined,typeof req.query.moneda==='string'?req.query.moneda:undefined));}catch(error){next(error);}
});
router.post('/calcular', controller.calcular);
router.post('/', controller.create);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.get('/:id/constancia', controller.constancia);
// Flujo: PREPARACIÓN → REVISIÓN → APROBACIÓN → EMISIÓN → ANULACIÓN
router.post('/:id/enviar-revision', controller.accion('enviarRevision'));
router.post('/:id/revisar', controller.accion('revisar'));
router.post('/:id/devolver', controller.accion('devolver'));
router.post('/:id/aprobar', controller.accion('aprobar'));
router.post('/:id/rechazar', controller.accion('rechazar'));
router.post('/:id/reabrir', controller.accion('reabrir'));
router.post('/:id/emitir', controller.accion('emitir'));
router.post('/:id/anular', controller.accion('anular'));

export default router;
