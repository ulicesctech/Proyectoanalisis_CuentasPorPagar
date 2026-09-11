import { createCxpController } from '../crud.controller';
import { cxpReglaAprobacionService } from '../../services/control/reglaAprobacion.service';

export const cxpReglaAprobacionController = createCxpController(cxpReglaAprobacionService);
