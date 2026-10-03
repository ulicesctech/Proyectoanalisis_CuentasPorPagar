import { createCxpRouter } from '../crud.routes';
import { cxpDocumentoController } from '../../controllers/documentos/documento.controller';

const router = createCxpRouter(cxpDocumentoController);
router.post('/calcular-vencimiento', cxpDocumentoController.previewDueDate);
router.get('/:id/expediente', cxpDocumentoController.expediente);
router.post('/:id/validar', cxpDocumentoController.validate);
router.get('/:id/aprobacion', cxpDocumentoController.approval);
router.post('/:id/aprobacion', cxpDocumentoController.decideApproval);

export default router;
