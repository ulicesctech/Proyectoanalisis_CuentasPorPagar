import { createCxpController } from '../crud.controller';
import { cxpDocumentoDetalleService } from '../../services/documentos/documentoDetalle.service';

export const cxpDocumentoDetalleController = createCxpController(cxpDocumentoDetalleService);
