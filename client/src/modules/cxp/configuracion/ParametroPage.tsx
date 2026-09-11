import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpParametroForm } from './components/ParametroForm';

export const CxpParametroPage = () => <CxpCrudPage resource="parametros" Form={CxpParametroForm} />;
