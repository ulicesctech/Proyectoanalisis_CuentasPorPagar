import { createCxpService } from '../crud.service';
import { cxpConciliacionProveedorRepository } from '../../repositories/conciliaciones/conciliacionProveedor.repository';

export const cxpConciliacionProveedorService = createCxpService(cxpConciliacionProveedorRepository);
