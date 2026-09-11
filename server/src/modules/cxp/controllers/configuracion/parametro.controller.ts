import { createCxpController } from '../crud.controller';
import { cxpParametroService } from '../../services/configuracion/parametro.service';

export const cxpParametroController = createCxpController(cxpParametroService);
