import { createCxpController } from '../crud.controller';
import { cxpPeriodoService } from '../../services/configuracion/periodo.service';

export const cxpPeriodoController = createCxpController(cxpPeriodoService);
