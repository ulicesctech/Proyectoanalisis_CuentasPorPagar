import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpAplicacionForm } from './components/AplicacionForm';

export const CxpAplicacionPage = () => <CxpCrudPage resource="aplicaciones" Form={CxpAplicacionForm} />;
