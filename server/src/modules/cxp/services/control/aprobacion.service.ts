import { createCxpService } from '../crud.service';
import { cxpAprobacionRepository } from '../../repositories/control/aprobacion.repository';

export const cxpAprobacionService = createCxpService(cxpAprobacionRepository);
