import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpAprobacionForm } from './components/AprobacionForm';

export const CxpAprobacionPage = () => <CxpCrudPage resource="aprobaciones" Form={CxpAprobacionForm} />;
