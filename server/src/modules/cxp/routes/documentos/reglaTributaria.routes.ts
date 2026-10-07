import { Router } from 'express';
import { registerIdParams } from '../../../../shared';
import { cxpReglaTributariaController as controller } from '../../controllers/documentos/reglaTributaria.controller';

const router = Router();
registerIdParams(router);

// Las reglas no se editan ni eliminan: cada cambio es una versión nueva y el historial se conserva.
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/versiones', controller.nuevaVersion);
router.post('/:id/finalizar', controller.finalizar);

export default router;
