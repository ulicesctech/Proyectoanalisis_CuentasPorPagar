import { createCxpService } from '../crud.service';
import { cxpPagoRepository } from '../../repositories/pagos/pago.repository';

export const cxpPagoService = createCxpService(cxpPagoRepository);
