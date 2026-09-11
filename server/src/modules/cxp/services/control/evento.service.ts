import { createCxpService } from '../crud.service';
import { cxpEventoRepository } from '../../repositories/control/evento.repository';

export const cxpEventoService = createCxpService(cxpEventoRepository);
