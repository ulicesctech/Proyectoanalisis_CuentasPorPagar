import { CXP_SCHEMAS } from '@erp/contracts';
import { cxpFormText, type CxpFormScalar } from '../components/cxpFormValues';

/** El valor local procede del esquema existente, sin depender de un export nuevo precargado por Vite. */
export function initialDocumentoRegistroValues(actorId?: CxpFormScalar) {
  return {
    idProveedor: '', idSucursal: '', idCompromiso: '', creadoPor: cxpFormText(actorId), tipoDocumento: 'FACTURA', naturaleza: 'D',
    idCondicionCredito: '', origenIngreso: 'FACTURACION_ELECTRONICA', tipoRegistro: 'SIN_OC',
    serie: '', numeroDocumento: '', uuidFiscal: '', nitEmisor: '', hashOrigen: '', noOrdenCompra: '',
    fechaDocumento: '', fechaVencimiento: '', moneda: CXP_SCHEMAS.documentos.create.shape.moneda.parse(undefined),
    tipoCambio: '1', fuenteTipoCambio: '', fechaTipoCambio: '', subtotal: '', descuentoTotal: '0', impuestoTotal: '0',
    retencionTotal: '0', recargoTotal: '0', gastoAdicionalTotal: '0', diferenciaRedondeo: '0', observaciones: '',
  };
}
