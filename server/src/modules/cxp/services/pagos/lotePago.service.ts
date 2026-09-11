import { createCxpService } from '../crud.service';
import { cxpLotePagoRepository } from '../../repositories/pagos/lotePago.repository';

export const cxpLotePagoService = createCxpService(cxpLotePagoRepository);
