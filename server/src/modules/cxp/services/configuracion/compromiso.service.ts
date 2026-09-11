import { createCxpService } from '../crud.service';
import { cxpCompromisoRepository } from '../../repositories/configuracion/compromiso.repository';

export const cxpCompromisoService = createCxpService(cxpCompromisoRepository);
