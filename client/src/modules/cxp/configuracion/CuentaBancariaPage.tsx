import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpCuentaBancariaForm } from './components/CuentaBancariaForm';

export const CxpCuentaBancariaPage = () => <CxpCrudPage resource="cuentas-bancarias" Form={CxpCuentaBancariaForm} />;
