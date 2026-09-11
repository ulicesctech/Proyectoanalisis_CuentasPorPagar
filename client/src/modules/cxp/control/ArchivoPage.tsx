import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpArchivoForm } from './components/ArchivoForm';

export const CxpArchivoPage = () => <CxpCrudPage resource="archivos" Form={CxpArchivoForm} />;
