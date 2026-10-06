import { createCxpRouter } from '../crud.routes';
import { cxpDocumentoController } from '../../controllers/documentos/documento.controller';
import { raw } from 'express';
import { dteMaxBytes } from '../../services/documentos/dte.storage';

const router = createCxpRouter(cxpDocumentoController);
router.post('/calcular-vencimiento', cxpDocumentoController.previewDueDate);
router.get('/:id/expediente', cxpDocumentoController.expediente);
router.post('/:id/validar', cxpDocumentoController.validate);
router.get('/:id/aprobacion', cxpDocumentoController.approval);
router.post('/:id/aprobacion', cxpDocumentoController.decideApproval);
router.post('/:id/archivos', raw({ type: () => true, limit: dteMaxBytes() }), cxpDocumentoController.uploadDte);
router.get('/:id/archivos', cxpDocumentoController.listFiles);
router.get('/:id/archivos/:idArchivo/descargar', cxpDocumentoController.downloadDte);

export default router;
