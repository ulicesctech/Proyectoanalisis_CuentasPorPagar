import { getCxpEntity } from './metadata';
import { cxpMoneyMultiply, cxpMoneySum } from './decimal';
import type { CxpRecord, CxpResource, CxpValidationIssue } from './types';

const present = (value: unknown) => value !== null && value !== undefined && value !== '';

/** Devuelve una copia; PATCH se combina con la fila bloqueada antes de calcular. */
export function prepareCxpRecord(resource: CxpResource, input: CxpRecord): CxpRecord {
  const value = { ...input };
  const n = (key: string) => Number(value[key] ?? 0);
  if (resource === 'documentos') {
    value.montoAplicado ??= 0;
    value.totalBruto = cxpMoneySum(n('subtotal'), -n('descuentoTotal'), n('impuestoTotal'), n('recargoTotal'), n('gastoAdicionalTotal'), n('diferenciaRedondeo'));
    value.totalNeto = cxpMoneySum(n('totalBruto'), -n('retencionTotal'));
    value.totalLocal = cxpMoneyMultiply(n('totalNeto'), Number(value.tipoCambio ?? 1));
    value.saldoPendiente = cxpMoneySum(n('totalNeto'), -n('montoAplicado'));
  }
  if (resource === 'documentos-detalle') {
    value.subtotal = cxpMoneySum(cxpMoneyMultiply(n('cantidad'), n('precioUnitario')), -n('descuento'));
    value.totalLinea = cxpMoneySum(n('subtotal'), n('impuesto'), -n('retencion'));
  }
  if (resource === 'pagos') {
    value.montoAplicado ??= 0;
    value.montoTransferido = cxpMoneySum(n('montoObligacion'), -n('montoDescuento'), -n('montoRetencion'), n('montoComision'));
    value.montoNoAplicado = cxpMoneySum(n('montoObligacion'), -n('montoAplicado'));
  }
  return value;
}

export function validateCxpRecord(resource: CxpResource, value: CxpRecord): CxpValidationIssue[] {
  const issues: CxpValidationIssue[] = [];
  const fail = (campo: string, mensaje: string) => issues.push({ campo, mensaje });
  const n = (key: string) => Number(value[key] ?? 0);
  const has = (key: string) => present(value[key]);
  const need = (...keys: string[]) => keys.forEach(key => { if (!has(key)) fail(key, 'Este campo es obligatorio para el estado o tipo seleccionado'); });
  const nonnegative = (...keys: string[]) => keys.forEach(key => { if (has(key) && n(key) < 0) fail(key, 'El valor debe ser mayor o igual a cero'); });
  const positive = (...keys: string[]) => keys.forEach(key => { if (has(key) && n(key) <= 0) fail(key, 'El valor debe ser mayor a cero'); });
  const dates = (from: string, to: string) => {
    if (has(from) && has(to) && String(value[to]).slice(0, 10) < String(value[from]).slice(0, 10)) fail(to, 'La fecha final no puede ser anterior a la inicial');
  };
  const distinct = (a: string, b: string) => { if (has(a) && has(b) && value[a] === value[b]) fail(b, 'Debe ser diferente del registro de origen'); };
  const onlySource = (required: string | undefined, sources: string[]) => {
    if (required) need(required);
    sources.filter(key => key !== required).forEach(key => { if (has(key)) fail(key, 'No corresponde al tipo seleccionado; deja este campo vacío'); });
  };
  if (has('moneda') && String(value.moneda).length !== 3) fail('moneda', 'La moneda debe tener tres letras, por ejemplo GTQ');
  const association = getCxpEntity(resource)?.associationFields;
  if (association && association.filter(has).length !== 1) fail(association[0], 'Selecciona exactamente una entidad relacionada');

  switch (resource) {
    case 'parametros':
      if (!has('valorTexto') && !has('valorNumero')) fail('valorTexto', 'Ingresa un valor de texto o un valor numérico');
      break;
    case 'periodos':
      if (n('mes') < 1 || n('mes') > 12) fail('mes', 'El mes debe estar entre 1 y 12');
      dates('fechaInicio', 'fechaFin');
      if (value.estado === 'CERRADO') need('cerradoPor', 'fechaCierre');
      if (value.estado === 'REABIERTO') need('reabiertoPor', 'fechaReapertura', 'motivoReapertura');
      break;
    case 'cuentas-bancarias':
      onlySource(value.tipoTitular === 'EMPRESA' ? 'idEmpresa' : 'idProveedor', ['idEmpresa', 'idProveedor']);
      if (value.estadoAprobacion === 'APROBADA') {
        need('fechaVerificacion', 'verificadoPor');
        if (value.titularCoincide !== 'S') fail('titularCoincide', 'Para aprobar, el titular debe coincidir');
      }
      if (value.estado === 'BLOQUEADA') need('motivoBloqueo');
      break;
    case 'compromisos':
      dates('fechaInicio', 'fechaFin');
      if (has('diaVencimiento') && (n('diaVencimiento') < 1 || n('diaVencimiento') > 31)) fail('diaVencimiento', 'El día debe estar entre 1 y 31');
      nonnegative('montoTotal', 'saldoCapital', 'tasaInteres', 'valorCuota');
      positive('numeroCuotas');
      if (n('saldoCapital') > n('montoTotal')) fail('saldoCapital', 'El saldo no puede superar el monto total');
      break;
    case 'documentos':
      if (value.tipoRegistro === 'CON_OC') need('noOrdenCompra');
      if (value.origenIngreso === 'COMPRAS') need('noFacturaCompra');
      positive('tipoCambio');
      nonnegative('subtotal', 'descuentoTotal', 'impuestoTotal', 'retencionTotal', 'recargoTotal', 'gastoAdicionalTotal', 'totalBruto', 'totalNeto', 'totalLocal', 'montoAplicado', 'saldoPendiente', 'capitalCuota', 'interesCuota', 'comisionCuota');
      if (n('montoAplicado') > n('totalNeto')) fail('subtotal', 'El total neto no puede ser menor al monto ya aplicado');
      if (value.estado === 'RECHAZADA') need('motivoRechazo');
      if (value.estado === 'BLOQUEADA') need('motivoBloqueo');
      if (value.estado === 'ANULADA') need('motivoAnulacion', 'anuladoPor', 'fechaAnulacion');
      distinct('idDocumento', 'idDocumentoRelacionado');
      break;
    case 'documentos-detalle':
      positive('cantidad');
      nonnegative('precioUnitario', 'descuento', 'subtotal', 'impuesto', 'retencion', 'totalLinea');
      break;
    case 'documentos-tributos':
      nonnegative('baseImponible', 'porcentaje', 'monto', 'montoRecuperable', 'montoNoRecuperable');
      break;
    case 'lotes-pago':
      nonnegative('cantidadPagos', 'montoTotal');
      if (['ENVIADO', 'EN_PROCESO', 'EJECUTADO', 'PARCIAL'].includes(String(value.estado))) need('enviadoPor', 'fechaEnvio');
      break;
    case 'pagos':
      distinct('idCuentaOrigen', 'idCuentaDestino');
      distinct('idPago', 'idPagoOrigen');
      positive('montoObligacion', 'tipoCambio');
      nonnegative('montoDescuento', 'montoRetencion', 'montoComision', 'montoTransferido', 'montoAplicado', 'montoNoAplicado');
      if (n('montoAplicado') > n('montoObligacion')) fail('montoObligacion', 'La obligación no puede ser menor al monto ya aplicado');
      if (['DEVOLUCION', 'REVERSO'].includes(String(value.tipoPago))) need('idPagoOrigen');
      if (value.estado === 'RECHAZADO') need('motivoRechazo');
      if (value.estado === 'DEVUELTO') need('motivoDevolucion');
      if (value.estado === 'ANULADO') need('motivoAnulacion');
      distinct('programadoPor', 'ejecutadoPor');
      distinct('programadoPor', 'conciliadoPor');
      distinct('ejecutadoPor', 'conciliadoPor');
      if (['EJECUTADO', 'CONFIRMADO', 'PARCIALMENTE_APLICADO', 'APLICADO', 'CONCILIADO'].includes(String(value.estado))) need('ejecutadoPor', 'fechaPago');
      break;
    case 'aplicaciones': {
      const source = ['PAGO', 'ANTICIPO'].includes(String(value.tipoAplicacion)) ? 'idPago' : value.tipoAplicacion === 'COMPENSACION_CXC' ? 'idDocumentoCxc' : 'idDocumentoOrigen';
      onlySource(source, ['idPago', 'idDocumentoOrigen', 'idDocumentoCxc']);
      distinct('idDocumentoDestino', 'idDocumentoOrigen');
      nonnegative('montoPrincipal', 'montoDescuento', 'montoRetencion');
      positive('montoTotalAplicado');
      if (value.estado === 'REVERTIDA') need('revertidoPor', 'fechaReverso', 'motivoReverso');
      break;
    }
    case 'reglas-aprobacion':
      nonnegative('montoDesde');
      if (has('montoHasta') && n('montoHasta') < n('montoDesde')) fail('montoHasta', 'El monto máximo no puede ser menor al mínimo');
      dates('vigenteDesde', 'vigenteHasta');
      positive('nivel', 'cantidadAprobadores');
      break;
    case 'aprobaciones':
      positive('nivel');
      if (['APROBADA', 'RECHAZADA'].includes(String(value.estado))) need('idUsuarioAprobador', 'fechaDecision');
      break;
    case 'conciliaciones-proveedor':
      dates('periodoDesde', 'periodoHasta');
      if (value.estado === 'CERRADA') need('cerradaPor', 'fechaCierre');
      break;
    case 'conciliaciones-proveedor-detalle':
      onlySource(value.tipoRegistro === 'DOCUMENTO' ? 'idDocumento' : value.tipoRegistro === 'PAGO' ? 'idPago' : undefined, ['idDocumento', 'idPago']);
      break;
    case 'conciliaciones-pago':
      nonnegative('montoBanco', 'montoSistema');
      if (['CONCILIADO_AUTOMATICO', 'CONCILIADO_MANUAL'].includes(String(value.estado))) need('conciliadoPor', 'fechaConciliacion');
      break;
    case 'eventos':
      distinct('idEvento', 'idEventoPadre');
      if (value.estado === 'CERRADO') need('fechaCierre');
      break;
    case 'archivos':
      positive('tamanoBytes', 'versionArchivo');
      if (!/^[a-fA-F0-9]{64}$/.test(String(value.hashSha256 ?? ''))) fail('hashSha256', 'Ingresa un SHA-256 de 64 caracteres hexadecimales');
      break;
  }
  return issues;
}

export function isCxpFieldVisible(resource: CxpResource, field: string, value: CxpRecord): boolean {
  if (resource === 'cuentas-bancarias' && ['idEmpresa', 'idProveedor'].includes(field)) return field === (value.tipoTitular === 'EMPRESA' ? 'idEmpresa' : 'idProveedor');
  if (resource === 'aplicaciones' && ['idPago', 'idDocumentoOrigen', 'idDocumentoCxc'].includes(field)) {
    return field === (['PAGO', 'ANTICIPO'].includes(String(value.tipoAplicacion)) ? 'idPago' : value.tipoAplicacion === 'COMPENSACION_CXC' ? 'idDocumentoCxc' : 'idDocumentoOrigen');
  }
  if (resource === 'conciliaciones-proveedor-detalle' && ['idDocumento', 'idPago'].includes(field)) return field === (value.tipoRegistro === 'DOCUMENTO' ? 'idDocumento' : value.tipoRegistro === 'PAGO' ? 'idPago' : '');
  return true;
}
