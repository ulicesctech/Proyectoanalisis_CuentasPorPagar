import { createCxpController } from '../crud.controller';
import { cxpConciliacionPagoService } from '../../services/conciliaciones/conciliacionPago.service';

export const cxpConciliacionPagoController = createCxpController(cxpConciliacionPagoService);
