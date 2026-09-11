import { CxpCrudPage } from '../components/CxpCrudPage';
import { CxpDocumentoDetalleForm } from './components/DocumentoDetalleForm';

export const CxpDocumentoDetallePage = () => <CxpCrudPage resource="documentos-detalle" Form={CxpDocumentoDetalleForm} />;
