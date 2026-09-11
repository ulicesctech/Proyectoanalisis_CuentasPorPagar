import { createCxpService } from '../crud.service';
import { cxpDocumentoRepository } from '../../repositories/documentos/documento.repository';

export const cxpDocumentoService = createCxpService(cxpDocumentoRepository);
