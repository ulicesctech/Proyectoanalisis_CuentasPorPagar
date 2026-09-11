import { createCxpController } from '../crud.controller';
import { cxpConciliacionProveedorDetalleService } from '../../services/conciliaciones/conciliacionProveedorDetalle.service';

export const cxpConciliacionProveedorDetalleController = createCxpController(cxpConciliacionProveedorDetalleService);
