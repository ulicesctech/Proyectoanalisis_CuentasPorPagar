import { createCxpService } from '../crud.service';
import { cxpDocumentoTributoRepository } from '../../repositories/documentos/documentoTributo.repository';

export const cxpDocumentoTributoService = createCxpService(cxpDocumentoTributoRepository);
