import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpEventoForm } from './components/EventoForm';

export const CxpEventoPage = () => <CxpCrudPage resource="eventos" Form={CxpEventoForm} />;
