import { createCxpRouter } from '../crud.routes';
import { cxpDocumentoController } from '../../controllers/documentos/documento.controller';

export default createCxpRouter(cxpDocumentoController);
