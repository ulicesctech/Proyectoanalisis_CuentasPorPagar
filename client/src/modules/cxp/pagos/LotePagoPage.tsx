import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpLotePagoForm } from './components/LotePagoForm';

export const CxpLotePagoPage = () => <CxpCrudPage resource="lotes-pago" Form={CxpLotePagoForm} />;
