import { createCxpController } from '../crud.controller';
import { cxpAplicacionService } from '../../services/pagos/aplicacion.service';

export const cxpAplicacionController = createCxpController(cxpAplicacionService);
