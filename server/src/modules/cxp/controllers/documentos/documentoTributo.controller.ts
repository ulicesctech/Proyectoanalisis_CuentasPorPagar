import { createCxpController } from '../crud.controller';
import { cxpDocumentoTributoService } from '../../services/documentos/documentoTributo.service';

export const cxpDocumentoTributoController = createCxpController(cxpDocumentoTributoService);
