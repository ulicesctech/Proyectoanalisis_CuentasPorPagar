import { createCxpService } from '../crud.service';
import { cxpConciliacionProveedorDetalleRepository } from '../../repositories/conciliaciones/conciliacionProveedorDetalle.repository';

export const cxpConciliacionProveedorDetalleService = createCxpService(cxpConciliacionProveedorDetalleRepository);
