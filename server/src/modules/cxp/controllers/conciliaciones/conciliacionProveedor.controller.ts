import { createCxpController } from '../crud.controller';
import { cxpConciliacionProveedorService } from '../../services/conciliaciones/conciliacionProveedor.service';

export const cxpConciliacionProveedorController = createCxpController(cxpConciliacionProveedorService);
