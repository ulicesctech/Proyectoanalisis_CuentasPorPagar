import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpDocumentoTributoForm } from './components/DocumentoTributoForm';

export const CxpDocumentoTributoPage = () => <CxpCrudPage resource="documentos-tributos" Form={CxpDocumentoTributoForm} />;
