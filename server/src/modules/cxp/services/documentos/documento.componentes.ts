import { createHash } from 'node:crypto';
import oracledb, { type Connection } from 'oracledb';
import {
  calcularDocumentoComponentes, componenteLineaDatos, componenteTributoDatos, documentoComponentesSchema, cxpMoneySum,
  type ActorProceso, type CxpConceptoTributo, type CxpDocumentoComponentesContexto, type CxpRecord,
} from '@erp/contracts';
import { createCxpRepository, mapRow, options, selection, withCxpTransaction } from '../../repositories/crud.repository';
import { CXP_TABLES } from '../../repositories/definitions';
import { assertOutsideProcess } from '../../repositories/proceso-guard.repository';
import { assertCxpDocumentoComponentsEditable } from './documento.policy';
import { checkFacturaEspecialGuard } from './facturaEspecial.guard';
import { actorForField } from '../actorFields';
import { CxpError } from '../errors';

const eventType = 'CAPTURA_COMPONENTES';
const repository = (resource: 'documentos' | 'documentos-detalle' | 'documentos-tributos' | 'eventos', c: Connection) => createCxpRepository(resource).bind(c);
const pick = (row: CxpRecord, schema: { shape: object }) => Object.fromEntries(Object.keys(schema.shape).filter(name => row[name] !== undefined).map(name => [name, row[name]]));
async function rows(c: Connection, resource: 'documentos-detalle' | 'documentos-tributos', id: number) {
  const definition = CXP_TABLES[resource];
  const result = await c.execute<Record<string, string | number | null>>(
    `SELECT ${selection(resource)} FROM ${definition.table} WHERE ID_DOCUMENTO = :id ORDER BY ${definition.idColumn} FOR UPDATE`, { id }, options(resource));
  return (result.rows ?? []).map(row => mapRow(resource, row));
}
async function snapshot(c: Connection, id: number) {
  const documento = await repository('documentos', c).findById(id, true);
  if (!documento) throw new CxpError('Documento no encontrado', 404);
  const lineas = await rows(c, 'documentos-detalle', id), tributos = await rows(c, 'documentos-tributos', id);
  const audit = await c.execute<{ ID_EVENTO: number; RESULTADO_JSON: string | null }>(
    `SELECT ID_EVENTO, RESULTADO_JSON FROM CXP_EVENTO WHERE ID_EVENTO =
      (SELECT MAX(ID_EVENTO) FROM CXP_EVENTO WHERE ID_DOCUMENTO = :id AND TIPO_EVENTO = :tipo)`,
    { id, tipo: eventType }, { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo: { RESULTADO_JSON: { type: oracledb.STRING } } });
  let metadata: Record<string, Omit<CxpConceptoTributo, 'datos' | 'clave' | 'linea'>> = {};
  try { metadata = JSON.parse(audit.rows?.[0]?.RESULTADO_JSON ?? '{}').criterios ?? {}; }
  catch { throw new CxpError('La trazabilidad de criterios no se puede interpretar. No se sobrescribirá.', 409); }
  const version = createHash('sha256').update(JSON.stringify({ documento, lineas, tributos, metadata, ultimoEvento: audit.rows?.[0]?.ID_EVENTO ?? null })).digest('hex');
  return { documento, lineas, tributos, metadata, version };
}
function context(current: Awaited<ReturnType<typeof snapshot>>): CxpDocumentoComponentesContexto {
  const lineas = current.lineas.map(row => ({ clave: `linea-${row.idDetalle}`, idDetalle: Number(row.idDetalle), numeroLinea: Number(row.numeroLinea),
    datos: componenteLineaDatos.parse(pick(row, componenteLineaDatos)) }));
  const empty = calcularDocumentoComponentes(current.documento, lineas, []);
  const base = new Map(empty.lineas.map(line => [line.idDetalle, Number(line.datos.subtotal)]));
  const generalBase = cxpMoneySum(Number(empty.totales.subtotal), -Number(empty.totales.descuentoTotal));
  const tributos = current.tributos.filter(row => row.estado !== 'ANULADO').map(row => {
    const previous = current.metadata[String(row.idTributo)];
    return { clave: `tributo-${row.idTributo}`, idTributo: Number(row.idTributo),
      linea: row.idDetalle == null ? null : `linea-${row.idDetalle}`,
      calculo: previous?.calculo ?? 'CONSERVAR' as const, base: previous?.base ?? 'MANUAL' as const,
      tratamiento: previous?.tratamiento ?? (row.tipoTributo === 'IMPUESTO' && Number(row.montoRecuperable) > 0 && Number(row.montoNoRecuperable) > 0 ? 'PARCIAL' : 'CONSERVAR') as CxpConceptoTributo['tratamiento'],
      baseRevisadaPara: previous?.baseRevisadaPara ?? (row.idDetalle == null ? generalBase : base.get(Number(row.idDetalle)) ?? null),
      datos: componenteTributoDatos.parse(pick(row, componenteTributoDatos)) };
  });
  const editable = ['RECIBIDO', 'BORRADOR', 'PENDIENTE_CLASIFICACION'].includes(String(current.documento.estado)) &&
    Number(current.documento.montoAplicado) === 0 && current.documento.tipoDocumento !== 'FACTURA_ESPECIAL' &&
    !current.tributos.some(row => row.estado === 'APLICADO');
  const calculated = calcularDocumentoComponentes(current.documento, lineas, tributos);
  const advertencias = current.lineas.flatMap(row => {
    const line = calculated.lineas.find(item => item.idDetalle === row.idDetalle);
    return line && (line.datos.impuesto !== row.impuesto || line.datos.retencion !== row.retencion)
      ? [`Línea ${row.numeroLinea}: impuestos o retenciones históricos difieren de sus tributos. Guardar conceptos actualizará esos importes derivados; la declaración se conserva.`] : [];
  });
  return { documento: current.documento, lineas, tributos, version: current.version, editable, advertencias,
    catalogo: current.tributos.map(row => ({ tipo: String(row.tipoTributo), codigo: String(row.codigoTributo), nombre: String(row.nombreTributo) })),
    adoptarTotales: false, confirmarEliminaciones: [] };
}

export function createDocumentoComponentOperations(run: typeof withCxpTransaction = withCxpTransaction) {
  return {
    async read(id: number) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError('Documento inválido');
      return run(async c => context(await snapshot(c, id)));
    },
    async save(id: number, raw: unknown, actor: ActorProceso) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError('Documento inválido');
      if (!actor?.permisos.includes('CREAR')) throw new CxpError('Se requiere permiso de operación CXP', 403);
      const body = raw as { tributos?: Array<{ datos?: CxpRecord }> };
      for (const tax of Array.isArray(body?.tributos) ? body.tributos : []) actorForField(tax?.datos?.generadoPor, actor.id, 'generadoPor');
      const input = documentoComponentesSchema.parse(raw);
      return run(async c => {
        const current = await snapshot(c, id);
        if (input.version !== current.version) throw new CxpError('El documento cambió. Recarga antes de guardar; tus cambios no se aplicaron.', 409);
        assertCxpDocumentoComponentsEditable(current.documento);
        if (Number(current.documento.montoAplicado) !== 0) throw new CxpError('Un documento con aplicaciones no permite cambiar conceptos', 409);
        await assertOutsideProcess(c, 'documentos', current.documento);
        await checkFacturaEspecialGuard(c, 'documentos', current.documento, current.documento);
        const reserved = await c.execute(`SELECT ID_APLICACION FROM CXP_APLICACION
          WHERE (ID_DOCUMENTO_DESTINO = :id OR ID_DOCUMENTO_ORIGEN = :id) AND ESTADO IN ('PENDIENTE', 'APLICADA')`, { id });
        if (reserved.rows?.length) throw new CxpError('El documento tiene reservas o aplicaciones vigentes', 409);
        if (current.tributos.some(row => row.estado === 'APLICADO')) throw new CxpError('Los tributos aplicados se conservan; requieren su flujo de corrección.', 409);
        const lineIds = new Set(current.lineas.map(row => Number(row.idDetalle)));
        const taxIds = new Set(current.tributos.filter(row => row.estado !== 'ANULADO').map(row => Number(row.idTributo)));
        for (const [items, ids, field] of [[input.lineas, lineIds, 'idDetalle'], [input.tributos, taxIds, 'idTributo']] as const) {
          const sent = items.map(item => Number((item as Record<string, unknown>)[field])).filter(Boolean);
          if (new Set(sent).size !== sent.length || sent.some(value => !ids.has(value))) throw new CxpError('Hay registros repetidos o que no pertenecen al documento.', 409);
        }
        for (const tax of input.tributos) {
          if (!tax.idTributo && tax.calculo === 'CONSERVAR') throw new CxpError('Un tributo nuevo debe indicar cálculo porcentual o fijo', 422);
          if (!tax.idTributo && tax.datos.tipoTributo === 'IMPUESTO' && tax.tratamiento === 'CONSERVAR') throw new CxpError('Selecciona el tratamiento del impuesto nuevo', 422);
        }
        let calculated: ReturnType<typeof calcularDocumentoComponentes>;
        try { calculated = calcularDocumentoComponentes(current.documento, input.lineas, input.tributos); }
        catch (error) {
          if (error instanceof RangeError) throw new CxpError('Los importes calculados superan la precisión admitida.', 422);
          throw error;
        }
        if (calculated.issues.length) throw new CxpError('Revisa los conceptos indicados', 422, calculated.issues);
        const removedTax = current.tributos.filter(row => row.estado !== 'ANULADO' && !input.tributos.some(item => item.idTributo === row.idTributo));
        const removedLines = current.lineas.filter(row => !input.lineas.some(item => item.idDetalle === row.idDetalle));
        if (removedTax.some(row => !input.confirmarEliminaciones.includes(Number(row.idTributo)))) throw new CxpError('Confirma explícitamente los tributos que se quitarán.', 409);
        if (removedLines.some(line => current.tributos.some(tax => tax.estado === 'ANULADO' && tax.idDetalle === line.idDetalle))) throw new CxpError('La línea tiene historial de tributos anulados y debe conservarse.', 409);
        for (const row of removedTax) await repository('documentos-tributos', c).remove(Number(row.idTributo));
        let number = Math.max(0, ...current.lineas.map(row => Number(row.numeroLinea)));
        const assigned = new Map<string, number>();
        for (const line of calculated.lineas) {
          const data = { ...line.datos, idDocumento: id, numeroLinea: line.idDetalle
            ? current.lineas.find(row => row.idDetalle === line.idDetalle)!.numeroLinea : ++number };
          if (line.idDetalle) { await repository('documentos-detalle', c).update(line.idDetalle, data); assigned.set(line.clave, line.idDetalle); }
          else assigned.set(line.clave, await repository('documentos-detalle', c).create(data));
        }
        const criterios: Record<string, object> = {};
        for (const tax of calculated.tributos) {
          const data: CxpRecord = { ...tax.datos, idDocumento: id, idDetalle: tax.linea === null ? null : assigned.get(tax.linea)!,
            generadoPor: tax.idTributo ? current.tributos.find(row => row.idTributo === tax.idTributo)!.generadoPor : actor.id };
          let taxId = tax.idTributo;
          if (taxId) await repository('documentos-tributos', c).update(taxId, data);
          else taxId = await repository('documentos-tributos', c).create({ ...data, estado: 'CALCULADO' });
          criterios[String(taxId)] = { calculo: tax.calculo, base: tax.base, tratamiento: tax.tratamiento, baseRevisadaPara: tax.referencia };
        }
        for (const row of removedLines) await repository('documentos-detalle', c).remove(Number(row.idDetalle));
        if (input.adoptarTotales) {
          const fields = ['subtotal', 'descuentoTotal', 'impuestoTotal', 'retencionTotal', 'totalBruto', 'totalNeto', 'totalLocal', 'saldoPendiente'];
          await repository('documentos', c).update(id, { ...Object.fromEntries(fields.map(field => [field, calculated.totales[field]])), modificadoPor: actor.id });
        }
        const result = JSON.stringify({ criterios, declaradosAntes: current.documento,
          lineasAntes: current.lineas.map(row => ({ idDetalle: row.idDetalle, impuesto: row.impuesto, retencion: row.retencion, subtotal: row.subtotal, totalLinea: row.totalLinea })),
          eliminados: { lineas: removedLines, tributos: removedTax }, adoptoTotales: input.adoptarTotales });
        if (result.length > 30000) throw new CxpError('La trazabilidad supera la capacidad del campo JSON existente. No se guardó ningún cambio.', 422);
        await repository('eventos', c).create({ tipoEvento: eventType, asunto: 'Captura operativa de líneas y tributos', idDocumento: id,
          usuarioEvento: actor.id, resultadoJson: result, prioridad: 'NORMAL', estado: 'ABIERTO' });
        return context(await snapshot(c, id));
      });
    },
  };
}
export const documentoComponentOperations = createDocumentoComponentOperations();
