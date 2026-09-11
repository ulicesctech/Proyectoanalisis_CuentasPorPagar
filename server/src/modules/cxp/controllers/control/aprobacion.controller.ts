import { createCxpController } from '../crud.controller';
import { cxpAprobacionService } from '../../services/control/aprobacion.service';

export const cxpAprobacionController = createCxpController(cxpAprobacionService);
