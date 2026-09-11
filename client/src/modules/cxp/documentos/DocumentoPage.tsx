import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpDocumentoForm } from './components/DocumentoForm';

export const CxpDocumentoPage = () => <CxpCrudPage resource="documentos" Form={CxpDocumentoForm} />;
