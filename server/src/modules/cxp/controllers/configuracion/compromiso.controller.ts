import { createCxpController } from '../crud.controller';
import { cxpCompromisoService } from '../../services/configuracion/compromiso.service';

export const cxpCompromisoController = createCxpController(cxpCompromisoService);
