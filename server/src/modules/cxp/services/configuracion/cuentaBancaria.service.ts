import { createCxpService } from '../crud.service';
import { cxpCuentaBancariaRepository } from '../../repositories/configuracion/cuentaBancaria.repository';

export const cxpCuentaBancariaService = createCxpService(cxpCuentaBancariaRepository);
