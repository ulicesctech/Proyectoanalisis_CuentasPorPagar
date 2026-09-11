import { createCxpController } from '../crud.controller';
import { cxpPagoService } from '../../services/pagos/pago.service';

export const cxpPagoController = createCxpController(cxpPagoService);
