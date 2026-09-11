import { createCxpRouter } from '../crud.routes';
import { cxpCuentaBancariaController } from '../../controllers/configuracion/cuentaBancaria.controller';

export default createCxpRouter(cxpCuentaBancariaController);
