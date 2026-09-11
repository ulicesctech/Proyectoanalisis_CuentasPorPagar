import { createCxpController } from '../crud.controller';
import { cxpEventoService } from '../../services/control/evento.service';

export const cxpEventoController = createCxpController(cxpEventoService);
