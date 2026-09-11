import { createCxpController } from '../crud.controller';
import { cxpCuentaBancariaService } from '../../services/configuracion/cuentaBancaria.service';

export const cxpCuentaBancariaController = createCxpController(cxpCuentaBancariaService);
