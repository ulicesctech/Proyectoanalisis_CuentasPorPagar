import { createCxpService } from '../crud.service';
import { cxpReglaAprobacionRepository } from '../../repositories/control/reglaAprobacion.repository';

export const cxpReglaAprobacionService = createCxpService(cxpReglaAprobacionRepository);
