import { createCxpRouter } from '../crud.routes';
import { cxpPagoController } from '../../controllers/pagos/pago.controller';

export default createCxpRouter(cxpPagoController);
