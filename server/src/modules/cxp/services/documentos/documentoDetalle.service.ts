import { createCxpService } from '../crud.service';
import { cxpDocumentoDetalleRepository } from '../../repositories/documentos/documentoDetalle.repository';

export const cxpDocumentoDetalleService = createCxpService(cxpDocumentoDetalleRepository);
