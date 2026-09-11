import { createCxpController } from '../crud.controller';
import { cxpLotePagoService } from '../../services/pagos/lotePago.service';

export const cxpLotePagoController = createCxpController(cxpLotePagoService);
