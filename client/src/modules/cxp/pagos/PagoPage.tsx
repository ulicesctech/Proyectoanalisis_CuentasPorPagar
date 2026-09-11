import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpPagoForm } from './components/PagoForm';

export const CxpPagoPage = () => <CxpCrudPage resource="pagos" Form={CxpPagoForm} />;
