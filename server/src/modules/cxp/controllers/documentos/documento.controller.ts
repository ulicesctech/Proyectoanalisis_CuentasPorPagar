import { createCxpController } from '../crud.controller';
import { cxpDocumentoService } from '../../services/documentos/documento.service';

export const cxpDocumentoController = createCxpController(cxpDocumentoService);
