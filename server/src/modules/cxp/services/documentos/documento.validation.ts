import {
  cxpMoneyMultiply, cxpMoneySum, prepareCxpRecord, validateCxpRecord,
  type CxpRecord, type CxpValidationIssue,
} from '@erp/contracts';

type OracleComponent = Record<string, string | number | null>;

const amount = (value: unknown) => Number(value ?? 0);
const present = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';
const sum = (values: number[]) => cxpMoneySum(...values);

export function collectDocumentoValidationIssues(
  document: CxpRecord, details: OracleComponent[], tributes: OracleComponent[],
): CxpValidationIssue[] {
  const issues = validateCxpRecord('documentos', document);
  const fail = (campo: string, mensaje: string) => issues.push({ campo, mensaje });
  const requireField = (key: string) => { if (!present(document[key])) fail(key, 'Este campo es obligatorio para validar el documento'); };

  for (const key of ['idProveedor', 'idSucursal', 'tipoDocumento', 'fechaDocumento', 'moneda']) requireField(key);
  if (document.origenIngreso === 'FACTURACION_ELECTRONICA') {
    for (const key of ['uuidFiscal', 'serie', 'numeroDocumento']) requireField(key);
  }
  if (amount(document.totalNeto) <= 0) fail('totalNeto', 'El documento debe tener un total neto positivo');
  if (amount(document.montoAplicado) !== 0) fail('montoAplicado', 'Un documento RECIBIDO no puede tener aplicaciones');

  const computed = prepareCxpRecord('documentos', document);
  for (const key of ['totalBruto', 'totalNeto', 'saldoPendiente']) {
    if (amount(document[key]) !== amount(computed[key])) fail(key, 'No coincide con el cálculo de CXP_DOCUMENTO');
  }
  // RF04 exige coincidencia exacta: la holgura del CHECK de Oracle no es una tolerancia funcional de DTE.
  if (amount(document.totalLocal) !== amount(computed.totalLocal)) fail('totalLocal', 'No coincide con el cálculo de CXP_DOCUMENTO');

  if (!details.length) fail('detalles', 'El documento necesita al menos una línea');
  const detailIds = new Set<number>();
  const lineNumbers = new Set<number>();
  const lineGross: number[] = [];
  const lineDiscounts: number[] = [];
  const lineTaxes: number[] = [];
  const lineRetentions: number[] = [];
  details.forEach((detail, index) => {
    const field = (name: string) => `detalles[${index}].${name}`;
    for (const key of ['ID_DETALLE', 'NUMERO_LINEA', 'DESCRIPCION', 'CANTIDAD', 'UNIDAD_MEDIDA', 'PRECIO_UNITARIO']) {
      if (!present(detail[key])) fail(field(key), 'La línea está incompleta');
    }
    const number = amount(detail.NUMERO_LINEA);
    if (!Number.isSafeInteger(number) || number <= 0 || lineNumbers.has(number)) fail(field('NUMERO_LINEA'), 'Número de línea inválido o repetido');
    lineNumbers.add(number);
    detailIds.add(amount(detail.ID_DETALLE));
    if (amount(detail.CANTIDAD) <= 0 || amount(detail.PRECIO_UNITARIO) < 0) fail(field('CANTIDAD'), 'Cantidad o precio inválido');
    for (const key of ['DESCUENTO', 'SUBTOTAL', 'IMPUESTO', 'RETENCION', 'TOTAL_LINEA']) {
      if (!present(detail[key]) || amount(detail[key]) < 0) fail(field(key), 'Importe faltante o negativo');
    }
    const calculated = prepareCxpRecord('documentos-detalle', {
      cantidad: detail.CANTIDAD, precioUnitario: detail.PRECIO_UNITARIO, descuento: detail.DESCUENTO,
      impuesto: detail.IMPUESTO, retencion: detail.RETENCION,
    } as CxpRecord);
    if (amount(detail.SUBTOTAL) !== amount(calculated.subtotal)) fail(field('SUBTOTAL'), 'No coincide con cantidad, precio y descuento');
    if (amount(detail.TOTAL_LINEA) !== amount(calculated.totalLinea)) fail(field('TOTAL_LINEA'), 'No coincide con subtotal, impuesto y retención');
    lineGross.push(cxpMoneyMultiply(amount(detail.CANTIDAD), amount(detail.PRECIO_UNITARIO)));
    lineDiscounts.push(amount(detail.DESCUENTO));
    lineTaxes.push(amount(detail.IMPUESTO));
    lineRetentions.push(amount(detail.RETENCION));
  });

  const taxAmounts: number[] = [];
  const withholdingAmounts: number[] = [];
  tributes.forEach((tribute, index) => {
    const field = (name: string) => `tributos[${index}].${name}`;
    for (const key of ['ID_TRIBUTO', 'TIPO_TRIBUTO', 'CODIGO_TRIBUTO', 'NOMBRE_TRIBUTO', 'BASE_IMPONIBLE', 'PORCENTAJE', 'MONTO', 'MONTO_RECUPERABLE', 'MONTO_NO_RECUPERABLE', 'INCLUIDO_PRECIO', 'FECHA_APLICACION', 'GENERADO_POR', 'ESTADO']) {
      if (!present(tribute[key])) fail(field(key), 'El tributo está incompleto');
    }
    if (tribute.ID_DETALLE != null && !detailIds.has(amount(tribute.ID_DETALLE))) fail(field('ID_DETALLE'), 'La línea relacionada no pertenece al documento');
    for (const key of ['BASE_IMPONIBLE', 'PORCENTAJE', 'MONTO', 'MONTO_RECUPERABLE', 'MONTO_NO_RECUPERABLE']) {
      if (amount(tribute[key]) < 0) fail(field(key), 'El importe no puede ser negativo');
    }
    if (tribute.ESTADO === 'ANULADO') return;
    if (tribute.INCLUIDO_PRECIO === 'S' && amount(tribute.MONTO) !== 0) {
      fail(field('INCLUIDO_PRECIO'), 'Falta definir cómo conciliar tributos incluidos en precio');
    }
    if (tribute.TIPO_TRIBUTO === 'PERCEPCION' && amount(tribute.MONTO) !== 0) {
      fail(field('TIPO_TRIBUTO'), 'Falta definir cómo incluir percepciones en el total');
    }
    if (tribute.TIPO_TRIBUTO === 'IMPUESTO') taxAmounts.push(amount(tribute.MONTO));
    if (tribute.TIPO_TRIBUTO === 'RETENCION') withholdingAmounts.push(amount(tribute.MONTO));
  });

  const reconcile = (field: string, actual: number, expected: number) => {
    if (actual !== expected) fail(field, 'No coincide con el detalle o los tributos; no hay tolerancia RF04 configurada para esta diferencia');
  };
  reconcile('subtotal', amount(document.subtotal), sum(lineGross));
  reconcile('descuentoTotal', amount(document.descuentoTotal), sum(lineDiscounts));
  reconcile('impuestoTotal', amount(document.impuestoTotal), sum(lineTaxes));
  reconcile('impuestoTotal', amount(document.impuestoTotal), sum(taxAmounts));
  reconcile('retencionTotal', amount(document.retencionTotal), sum(lineRetentions));
  reconcile('retencionTotal', amount(document.retencionTotal), sum(withholdingAmounts));
  return issues;
}
