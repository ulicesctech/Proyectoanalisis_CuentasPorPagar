import { createCxpService } from '../crud.service';
import { cxpArchivoRepository } from '../../repositories/control/archivo.repository';

export const cxpArchivoService = createCxpService(cxpArchivoRepository);
