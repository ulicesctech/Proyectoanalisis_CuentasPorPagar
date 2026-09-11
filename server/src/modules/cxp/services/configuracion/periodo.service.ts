import { createCxpService } from '../crud.service';
import { cxpPeriodoRepository } from '../../repositories/configuracion/periodo.repository';

export const cxpPeriodoService = createCxpService(cxpPeriodoRepository);
