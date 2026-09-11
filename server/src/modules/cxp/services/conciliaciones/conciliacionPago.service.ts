import { createCxpService } from '../crud.service';
import { cxpConciliacionPagoRepository } from '../../repositories/conciliaciones/conciliacionPago.repository';

export const cxpConciliacionPagoService = createCxpService(cxpConciliacionPagoRepository);
