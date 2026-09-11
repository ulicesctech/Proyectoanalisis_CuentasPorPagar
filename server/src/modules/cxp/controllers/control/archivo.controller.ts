import { createCxpController } from '../crud.controller';
import { cxpArchivoService } from '../../services/control/archivo.service';

export const cxpArchivoController = createCxpController(cxpArchivoService);
