import { createCxpService } from '../crud.service';
import { cxpParametroRepository } from '../../repositories/configuracion/parametro.repository';

export const cxpParametroService = createCxpService(cxpParametroRepository);
