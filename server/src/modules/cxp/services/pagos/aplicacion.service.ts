import { createCxpService } from '../crud.service';
import { cxpAplicacionRepository } from '../../repositories/pagos/aplicacion.repository';

export const cxpAplicacionService = createCxpService(cxpAplicacionRepository);
