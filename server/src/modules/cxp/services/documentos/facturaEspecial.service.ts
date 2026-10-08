import { createHash } from 'node:crypto';
import type { Connection } from 'oracledb';
import {
  accionCxpFacturaEspecialSchema, buildPaginationMeta, calcularCxpFacturaEspecialSchema, createCxpFacturaEspecialSchema,
  cxpAllowedStates, cxpCalcularFacturaEspecial, cxpNow, motivoCxpFacturaEspecialSchema, prepareCxpRecord,
  updateCxpFacturaEspecialSchema, validateCxpRecord, CXP_ETAPAS_FACTURA_ESPECIAL,
  type CxpAccionFacturaEspecial, type CxpCalculoFacturaEspecial, type CxpFacturaEspecialDetalle, type CxpRecord,
  type CreateCxpFacturaEspecialInput,
} from '@erp/contracts';
import { getConnection } from '../../../../config/database';
import { createCxpRepository, withCxpTransaction } from '../../repositories/crud.repository';
import { listCxpOptions } from '../../repositories/catalogos.repository';
import { facturaEspecialTx, listFacturasEspeciales, type FacturaEspecialRow } from '../../repositories/documentos/facturaEspecial.repository';
import { reglaTributariaTx } from '../../repositories/documentos/reglaTributaria.repository';
import { CxpError } from '../errors';
import { checkApprovals, checkStateChange, resetApprovals } from '../workflow.service';
import { buildConstanciaPdf, type ConstanciaData } from './constanciaPdf';

const TIPO = 'FACTURA_ESPECIAL';
const documentos = createCxpRepository('documentos');
const eventos = createCxpRepository('eventos');
const aprobaciones = createCxpRepository('aprobaciones');
const archivos = createCxpRepository('archivos');

const label = (state: string) => state.replace(/_/g, ' ');
const numero = (fe: Pick<FacturaEspecialRow, 'serie' | 'numeroDocumento'>) => `${fe.serie}-${fe.numeroDocumento}`;
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function validId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError('El identificador debe ser un entero positivo');
  return id;
}

/** Nombre legible del usuario reutilizando el catálogo de CXP (tabla común USUARIO). */
async function nombresUsuarios(ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  for (const id of new Set(ids.filter((value): value is number => typeof value === 'number' && value > 0))) {
    try {
      const option = (await listCxpOptions('usuarios', { selected: String(id) })).find(item => Number(item.id) === id);
      map.set(id, option ? option.label.split(' · ').slice(1).join(' · ') || option.label : `Usuario #${id}`);
    } catch { map.set(id, `Usuario #${id}`); }
  }
  return map;
}

async function evento(connection: Connection, idDocumento: number, data: {
  tipo: string; asunto: string; detalle?: string; anterior?: string | null; nuevo?: string | null; monto?: number | null; usuario: number;
}) {
  const ahora = cxpNow();
  await eventos.bind(connection).create({
    idDocumento, tipoEvento: data.tipo, asunto: data.asunto.slice(0, 250), detalle: data.detalle?.slice(0, 2000) ?? null,
    estadoAnterior: data.anterior ?? null, estadoNuevo: data.nuevo ?? null, montoRelacionado: data.monto ?? null,
    canal: 'SISTEMA', prioridad: 'NORMAL', estado: 'CERRADO', usuarioEvento: data.usuario, fechaEvento: ahora, fechaCierre: ahora,
  });
}

/** Aplica las reglas cuya vigencia cubre la fecha de la operación. */
async function calcular(connection: Connection, input: { fechaDocumento: string; moneda: string; subtotal: number; descuentoTotal: number }): Promise<CxpCalculoFacturaEspecial> {
  const reglas = await reglaTributariaTx(connection).findVigentes({ tipoDocumento: TIPO, fecha: input.fechaDocumento, moneda: input.moneda });
  try { return cxpCalcularFacturaEspecial(input.subtotal, input.descuentoTotal, reglas); }
  catch (error) { throw new CxpError(error instanceof Error ? error.message : 'No se pudieron calcular los tributos', 409); }
}

/** Registro completo del documento para las validaciones compartidas del flujo. */
async function documentoActual(connection: Connection, idDocumento: number): Promise<CxpRecord> {
  return (await documentos.bind(connection).findById(idDocumento, true))!;
}

async function cargar(connection: Connection, idDocumento: number) {
  const fe = await facturaEspecialTx(connection).find(validId(idDocumento), true);
  if (!fe) throw new CxpError('Factura especial no encontrada', 404);
  return fe;
}

/** Cambia el estado del documento aplicando las mismas reglas de flujo que el resto de CXP. */
async function cambiarEstado(connection: Connection, fe: FacturaEspecialRow, estado: string, cambios: CxpRecord, usuario: number) {
  const actual = await documentoActual(connection, fe.idDocumento);
  const siguiente = { ...actual, ...cambios, estado };
  checkStateChange('documentos', actual, siguiente);
  const issues = validateCxpRecord('documentos', siguiente);
  if (issues.length) throw new CxpError('Revisa los campos indicados', 400, issues);
  await documentos.bind(connection).update(fe.idDocumento, { ...cambios, estado, modificadoPor: usuario });
  await resetApprovals(connection, 'documentos', fe.idDocumento, actual.estado, estado);
  return siguiente;
}

function acciones(fe: FacturaEspecialRow): CxpAccionFacturaEspecial[] {
  switch (fe.etapa) {
    case 'PREPARACION': return fe.estado === 'BORRADOR' ? ['editar', 'enviarRevision', 'anular'] : [];
    case 'REVISION': return ['revisar', 'devolver', 'rechazar'];
    case 'APROBACION': return ['aprobar', 'rechazar'];
    case 'RECHAZADA': return ['reabrir', 'anular'];
    case 'APROBADA': return ['emitir', 'anular'];
    case 'EMITIDA': return fe.montoAplicado === 0 && cxpAllowedStates('documentos', fe.estado)?.includes('ANULADA') ? ['constancia', 'anular'] : ['constancia'];
    case 'ANULADA': return fe.numeroConstancia ? ['constancia'] : [];
  }
}

async function detalle(connection: Connection, idDocumento: number): Promise<CxpFacturaEspecialDetalle> {
  const tx = facturaEspecialTx(connection);
  const fe = await tx.find(idDocumento);
  if (!fe) throw new CxpError('Factura especial no encontrada', 404);
  const [tributos, aprob, historial] = [await tx.tributos(idDocumento), await tx.aprobaciones(idDocumento), await tx.historial(idDocumento)];
  const nombres = await nombresUsuarios([...aprob.map(item => item.idUsuarioAprobador), ...historial.map(item => item.usuarioEvento)]);
  return {
    ...fe, tributos,
    aprobaciones: aprob.map(item => ({ ...item, usuarioAprobador: item.idUsuarioAprobador ? nombres.get(item.idUsuarioAprobador) ?? null : null })),
    historial: historial.map(item => ({ ...item, usuario: nombres.get(item.usuarioEvento) ?? null })),
    acciones: acciones(fe),
  };
}

function datosDocumento(input: CreateCxpFacturaEspecialInput, calculo: CxpCalculoFacturaEspecial, usuario: number): CxpRecord {
  return {
    idProveedor: input.idProveedor, idSucursal: input.idSucursal, fechaDocumento: input.fechaDocumento,
    fechaVencimiento: input.fechaVencimiento ?? null, moneda: input.moneda, tipoCambio: input.tipoCambio,
    subtotal: input.subtotal, descuentoTotal: input.descuentoTotal, impuestoTotal: calculo.impuestoTotal,
    retencionTotal: calculo.retencionTotal, recargoTotal: 0, gastoAdicionalTotal: 0, diferenciaRedondeo: 0,
    referenciaExterna: input.referenciaExterna, idDepartamento: input.idDepartamento ?? null,
    centroCosto: input.centroCosto || null, cuentaContable: input.cuentaContable || null, observaciones: input.observaciones || null,
    // Clave de origen: impide registrar dos veces la misma operación del proveedor, aun con peticiones simultáneas.
    hashOrigen: sha256(`${TIPO}|${input.idProveedor}|${input.referenciaExterna.trim().toUpperCase()}`),
    modificadoPor: usuario,
  };
}

async function datosProveedor(connection: Connection, input: CreateCxpFacturaEspecialInput) {
  const proveedor = await facturaEspecialTx(connection).proveedor(input.idProveedor);
  if (!proveedor) throw new CxpError('El proveedor seleccionado no existe', 400);
  const datos = {
    proveedorNombre: input.proveedorNombre?.trim() || proveedor.nombre,
    proveedorNit: input.proveedorNit || proveedor.nit || null,
    proveedorCui: input.proveedorCui || null,
    proveedorDireccion: input.proveedorDireccion || null,
    descripcionOperacion: input.descripcionOperacion,
  };
  if (!datos.proveedorNit && !datos.proveedorCui) {
    throw new CxpError('Revisa los campos indicados', 400, [{ campo: 'proveedorCui', mensaje: 'El proveedor no tiene NIT registrado: ingresa su NIT o su CUI/DPI' }]);
  }
  return datos;
}

async function sinDuplicado(connection: Connection, input: CreateCxpFacturaEspecialInput, excluir?: number) {
  const existente = await facturaEspecialTx(connection).existeReferencia(input.idProveedor, input.referenciaExterna, excluir);
  if (existente) throw new CxpError(`Ya existe la factura especial ${existente} para este proveedor con la referencia ${input.referenciaExterna}.`, 409);
}

function sinTributos(calculo: CxpCalculoFacturaEspecial) {
  if (!calculo.tributos.length) {
    throw new CxpError('No hay reglas tributarias vigentes para la fecha, moneda y monto de la operación. Configúralas en Reglas tributarias.', 409);
  }
}

/** Datos canónicos de la emisión; su SHA-256 es el código de verificación impreso en la constancia. */
function huellaEmision(fe: FacturaEspecialRow, tributos: Awaited<ReturnType<ReturnType<typeof facturaEspecialTx>['tributos']>>, numeroConstancia: string, fechaEmision: string, emitidoPor: number) {
  return sha256(JSON.stringify({
    numeroConstancia, numeroFactura: numero(fe), idDocumento: fe.idDocumento, idProveedor: fe.idProveedor,
    proveedor: fe.proveedorNombre, nit: fe.proveedorNit, cui: fe.proveedorCui, fechaOperacion: fe.fechaDocumento, fechaEmision,
    moneda: fe.moneda, tipoCambio: fe.tipoCambio, subtotal: fe.subtotal, descuento: fe.descuentoTotal, totalNeto: fe.totalNeto,
    tributos: tributos.map(t => [t.idReglaTributaria, t.tipoTributo, t.codigoTributo, t.baseImponible, t.porcentaje, t.monto]), emitidoPor,
  }));
}

async function datosConstancia(connection: Connection, fe: FacturaEspecialRow): Promise<ConstanciaData> {
  const tx = facturaEspecialTx(connection);
  const tributos = await tx.tributos(fe.idDocumento);
  const aprob = (await tx.aprobaciones(fe.idDocumento)).filter(item => item.estado === 'APROBADA');
  const nombres = await nombresUsuarios([fe.creadoPor, fe.revisadoPor, fe.emitidoPor, fe.anuladoPor, ...aprob.map(item => item.idUsuarioAprobador)]);
  const nombre = (id: number | null) => (id ? nombres.get(id) ?? `Usuario #${id}` : null);
  const suma = (filtro: (t: (typeof tributos)[number]) => boolean) => Math.round(tributos.filter(filtro).reduce((total, t) => total + t.monto, 0) * 100) / 100;
  const anulada = fe.etapa === 'ANULADA';
  return {
    numeroConstancia: fe.numeroConstancia!, numeroFactura: numero(fe), estado: anulada ? 'ANULADA' : 'EMITIDA',
    fechaOperacion: fe.fechaDocumento, fechaEmision: fe.fechaEmision!, fechaGeneracion: anulada && fe.fechaAnulacion ? fe.fechaAnulacion : fe.fechaEmision!,
    moneda: fe.moneda, tipoCambio: fe.tipoCambio,
    proveedor: { nombre: fe.proveedorNombre, nit: fe.proveedorNit, cui: fe.proveedorCui, direccion: fe.proveedorDireccion },
    descripcion: fe.descripcionOperacion, referencia: fe.referenciaExterna,
    montoOperacion: fe.subtotal, descuento: fe.descuentoTotal, baseImponible: Math.round((fe.subtotal - fe.descuentoTotal) * 100) / 100,
    tributos: tributos.map(t => ({ tipo: t.tipoTributo, codigo: t.codigoTributo, nombre: t.nombreTributo, porcentaje: t.porcentaje,
      base: t.baseImponible, monto: t.monto, regla: t.codigoRegla ? `${t.codigoRegla} v${t.versionRegla}` : 'manual' })),
    // Los códigos de tributo se configuran en las reglas; IVA e ISR se reconocen por su código.
    iva: suma(t => t.tipoTributo === 'IMPUESTO' && t.codigoTributo.startsWith('IVA')),
    isrRetenido: suma(t => t.tipoTributo === 'RETENCION' && t.codigoTributo.startsWith('ISR')),
    totalRetenciones: fe.retencionTotal, totalAPagar: fe.totalNeto,
    respaldo: {
      idDocumento: fe.idDocumento, registradoPor: nombre(fe.creadoPor)!, revisadoPor: nombre(fe.revisadoPor),
      aprobadoPor: aprob.map(item => nombre(item.idUsuarioAprobador)!).filter(Boolean), emitidoPor: nombre(fe.emitidoPor) ?? '—',
      codigoVerificacion: fe.hashConstancia ?? '—',
    },
    ...(anulada ? { anulacion: { motivo: fe.motivoAnulacion ?? '', usuario: nombre(fe.anuladoPor) ?? '—', fecha: fe.fechaAnulacion ?? '' } } : {}),
  };
}

async function registrarArchivoConstancia(connection: Connection, fe: FacturaEspecialRow, usuario: number) {
  const tx = facturaEspecialTx(connection);
  const pdf = buildConstanciaPdf(await datosConstancia(connection, fe));
  const anterior = await tx.archivoConstanciaActual(fe.idDocumento);
  if (anterior) await tx.desactivarArchivo(anterior.id);
  await archivos.bind(connection).create({
    idDocumento: fe.idDocumento, categoria: 'CONSTANCIA_FE',
    nombreArchivo: `constancia-${fe.numeroConstancia}${fe.etapa === 'ANULADA' ? '-anulada' : ''}.pdf`, tipoMime: 'application/pdf',
    tamanoBytes: pdf.length, uriAlmacenamiento: `api:/cxp/facturas-especiales/${fe.idDocumento}/constancia`, hashSha256: sha256(pdf),
    versionArchivo: (anterior?.version ?? 0) + 1, esVersionActual: 'S', cargadoPor: usuario, fechaCarga: cxpNow(),
  });
}

async function resultado(connection: Connection, idDocumento: number, mensaje: string) {
  return { mensaje, factura: await detalle(connection, idDocumento) };
}

export const cxpFacturaEspecialService = {
  async list(query: { page?: string; limit?: string; search?: string; etapa?: string; idProveedor?: string }) {
    const page = query.page === undefined ? 1 : Number(query.page);
    const limit = query.limit === undefined ? 10 : Number(query.limit);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new CxpError('Paginación inválida');
    if (query.etapa && ![...CXP_ETAPAS_FACTURA_ESPECIAL, 'BANDEJA'].includes(query.etapa)) throw new CxpError('Etapa inválida');
    const idProveedor = query.idProveedor ? validId(Number(query.idProveedor)) : undefined;
    const result = await listFacturasEspeciales({ page, limit, search: query.search?.trim().slice(0, 100), etapa: query.etapa, idProveedor });
    return { data: result.data, meta: buildPaginationMeta(result.total, page, limit) };
  },

  async getOne(id: number) {
    const connection = await getConnection();
    try { return await detalle(connection, validId(id)); }
    finally { await connection.close(); }
  },

  /** Vista previa del cálculo con las reglas vigentes (no guarda nada). */
  async calcular(raw: unknown) {
    const input = calcularCxpFacturaEspecialSchema.parse(raw);
    const connection = await getConnection();
    try { return await calcular(connection, input); }
    finally { await connection.close(); }
  },

  /** PREPARACIÓN: registra el documento en borrador con sus tributos calculados. */
  async create(raw: unknown) {
    const input = createCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const tx = facturaEspecialTx(connection);
      const proveedor = await datosProveedor(connection, input);
      await sinDuplicado(connection, input);
      const calculo = await calcular(connection, input);
      const serie = (await tx.parametro('CXP_FACTURA_ESPECIAL', 'SERIE'))?.texto;
      if (!serie) throw new CxpError('Configura la serie de facturas especiales (parámetro CXP_FACTURA_ESPECIAL / SERIE).', 409);
      const correlativo = await tx.siguienteCorrelativo('CORRELATIVO_FACTURA');
      const record = prepareCxpRecord('documentos', {
        ...datosDocumento(input, calculo, input.usuario), tipoDocumento: TIPO, naturaleza: 'D', origenIngreso: 'MANUAL',
        tipoRegistro: 'SIN_OC', justificacionSinOc: 'Factura especial: compra a proveedor que no emite factura propia.',
        serie, numeroDocumento: String(correlativo).padStart(8, '0'), estado: 'BORRADOR', estadoContable: 'PENDIENTE',
        creadoPor: input.usuario, modificadoPor: null, fechaRecepcion: cxpNow(), fechaCreacion: cxpNow(),
      });
      const issues = validateCxpRecord('documentos', record);
      if (issues.length) throw new CxpError('Revisa los campos indicados', 400, issues);
      const idDocumento = await documentos.bind(connection).create(record);
      await tx.insertExtension({ idDocumento, ...proveedor, creadoPor: input.usuario });
      await tx.reemplazarTributosCalculados(idDocumento, input.fechaDocumento, calculo.tributos, input.usuario);
      await evento(connection, idDocumento, {
        tipo: 'FE_REGISTRO', asunto: `Registro de factura especial ${serie}-${record.numeroDocumento}`, nuevo: 'BORRADOR', usuario: input.usuario,
        monto: calculo.totalNeto, detalle: `Tributos: ${calculo.tributos.map(t => `${t.codigoTributo} ${t.porcentaje}% = ${t.monto} (${t.codigoRegla} v${t.versionRegla})`).join('; ') || 'ninguno'}`,
      });
      return resultado(connection, idDocumento, 'Factura especial registrada en preparación.');
    });
  },

  /** Edición permitida solo en preparación; los tributos se recalculan con las reglas vigentes. */
  async update(id: number, raw: unknown) {
    const input = updateCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const fe = await cargar(connection, id);
      if (fe.estado !== 'BORRADOR' || fe.estadoEmision !== 'PENDIENTE') {
        throw new CxpError(`La factura está en ${label(fe.etapa)} y no puede modificarse. Solo se editan facturas en preparación (borrador).`, 409);
      }
      const proveedor = await datosProveedor(connection, input);
      await sinDuplicado(connection, input, fe.idDocumento);
      const calculo = await calcular(connection, input);
      const actual = await documentoActual(connection, fe.idDocumento);
      const record = prepareCxpRecord('documentos', { ...actual, ...datosDocumento(input, calculo, input.usuario) });
      checkStateChange('documentos', actual, record);
      const issues = validateCxpRecord('documentos', record);
      if (issues.length) throw new CxpError('Revisa los campos indicados', 400, issues);
      const cambios = Object.fromEntries(Object.entries(record).filter(([key, value]) => key !== 'idDocumento' && value !== actual[key]));
      await documentos.bind(connection).update(fe.idDocumento, cambios);
      await facturaEspecialTx(connection).updateExtension(fe.idDocumento, proveedor);
      await facturaEspecialTx(connection).reemplazarTributosCalculados(fe.idDocumento, input.fechaDocumento, calculo.tributos, input.usuario);
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_EDICION', asunto: `Edición de factura especial ${numero(fe)}`, anterior: fe.estado, nuevo: fe.estado, usuario: input.usuario,
        monto: calculo.totalNeto, detalle: `Total anterior ${fe.totalNeto}; total nuevo ${calculo.totalNeto}.`,
      });
      return resultado(connection, fe.idDocumento, 'Factura especial actualizada.');
    });
  },

  /** PREPARACIÓN → REVISIÓN. Recalcula antes de enviar para no usar reglas fuera de vigencia. */
  async enviarRevision(id: number, raw: unknown) {
    const input = accionCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const fe = await cargar(connection, id);
      if (fe.estado !== 'BORRADOR') throw new CxpError('Solo una factura en preparación puede enviarse a revisión.', 409);
      const calculo = await calcular(connection, { fechaDocumento: fe.fechaDocumento, moneda: fe.moneda, subtotal: fe.subtotal, descuentoTotal: fe.descuentoTotal });
      sinTributos(calculo);
      const actual = await documentoActual(connection, fe.idDocumento);
      const recalculado = prepareCxpRecord('documentos', { ...actual, impuestoTotal: calculo.impuestoTotal, retencionTotal: calculo.retencionTotal });
      const cambios = Object.fromEntries(['impuestoTotal', 'retencionTotal', 'totalBruto', 'totalNeto', 'totalLocal', 'saldoPendiente']
        .filter(key => recalculado[key] !== actual[key]).map(key => [key, recalculado[key]]));
      await facturaEspecialTx(connection).reemplazarTributosCalculados(fe.idDocumento, fe.fechaDocumento, calculo.tributos, input.usuario);
      await cambiarEstado(connection, fe, 'PENDIENTE_REVISION', cambios, input.usuario);
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_ENVIO_REVISION', asunto: `Factura especial ${numero(fe)} enviada a revisión`, anterior: fe.estado, nuevo: 'PENDIENTE_REVISION',
        usuario: input.usuario, monto: calculo.totalNeto, detalle: input.observacion ?? undefined,
      });
      return resultado(connection, fe.idDocumento, 'Factura enviada a revisión.');
    });
  },

  /** REVISIÓN → APROBACIÓN, dejando constancia de quién revisó. */
  async revisar(id: number, raw: unknown) {
    const input = accionCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const fe = await cargar(connection, id);
      if (fe.estado !== 'PENDIENTE_REVISION') throw new CxpError('La factura no está pendiente de revisión.', 409);
      await cambiarEstado(connection, fe, 'PENDIENTE_APROBACION', {}, input.usuario);
      await facturaEspecialTx(connection).registrarRevision(fe.idDocumento, input.usuario, input.observacion ?? null);
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_REVISION', asunto: `Factura especial ${numero(fe)} revisada`, anterior: fe.estado, nuevo: 'PENDIENTE_APROBACION',
        usuario: input.usuario, detalle: input.observacion ?? undefined,
      });
      return resultado(connection, fe.idDocumento, 'Revisión registrada. La factura queda pendiente de aprobación.');
    });
  },

  /** REVISIÓN → PREPARACIÓN para corregir datos. */
  async devolver(id: number, raw: unknown) {
    const input = motivoCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const fe = await cargar(connection, id);
      if (fe.estado !== 'PENDIENTE_REVISION') throw new CxpError('Solo se devuelven facturas que están en revisión.', 409);
      await cambiarEstado(connection, fe, 'BORRADOR', {}, input.usuario);
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_DEVOLUCION', asunto: `Factura especial ${numero(fe)} devuelta a preparación`, anterior: fe.estado, nuevo: 'BORRADOR',
        usuario: input.usuario, detalle: input.motivo,
      });
      return resultado(connection, fe.idDocumento, 'Factura devuelta a preparación.');
    });
  },

  /**
   * APROBACIÓN: solo aprobadores autorizados (parámetro CXP_FE_APROBADOR) y distintos
   * de quien registró. La decisión se guarda en CXP_APROBACION y el documento pasa a
   * APROBADA cuando se cumplen las reglas de aprobación configuradas.
   */
  async aprobar(id: number, raw: unknown) {
    const input = accionCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const tx = facturaEspecialTx(connection);
      const fe = await cargar(connection, id);
      if (fe.estado !== 'PENDIENTE_APROBACION') throw new CxpError(`La factura está en ${label(fe.etapa)}; solo se aprueban facturas revisadas y pendientes de aprobación.`, 409);
      const autorizado = await tx.aprobadorAutorizado(input.usuario);
      if (!autorizado) throw new CxpError('El usuario no está autorizado para aprobar facturas especiales.', 403);
      if (input.usuario === fe.creadoPor) throw new CxpError('Quien registró la factura no puede aprobarla (segregación de funciones).', 403);
      if ((await tx.aprobaciones(fe.idDocumento)).some(item => item.estado === 'APROBADA' && item.idUsuarioAprobador === input.usuario)) {
        throw new CxpError('Este usuario ya aprobó la factura en la ronda actual.', 409);
      }
      const ahora = cxpNow();
      await aprobaciones.bind(connection).create({
        idDocumento: fe.idDocumento, nivel: 1, idRolAprobador: autorizado.idRol, idUsuarioAprobador: input.usuario,
        estado: 'APROBADA', accion: 'APROBAR_FACTURA_ESPECIAL', fechaSolicitud: ahora, fechaDecision: ahora, observacion: input.observacion ?? null,
      });
      const actual = await documentoActual(connection, fe.idDocumento);
      try {
        await checkApprovals(connection, 'documentos', fe.idDocumento, { ...actual, estado: 'APROBADA' }, actual.estado);
      } catch (error) {
        if (!(error instanceof CxpError) || error.status !== 409) throw error;
        await evento(connection, fe.idDocumento, {
          tipo: 'FE_APROBACION_PARCIAL', asunto: `Aprobación parcial de ${numero(fe)}`, anterior: fe.estado, nuevo: fe.estado,
          usuario: input.usuario, detalle: error.message,
        });
        return resultado(connection, fe.idDocumento, `Aprobación registrada. ${error.message}`);
      }
      await cambiarEstado(connection, fe, 'APROBADA', {}, input.usuario);
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_APROBACION', asunto: `Factura especial ${numero(fe)} aprobada`, anterior: fe.estado, nuevo: 'APROBADA',
        usuario: input.usuario, monto: fe.totalNeto, detalle: input.observacion ?? undefined,
      });
      return resultado(connection, fe.idDocumento, 'Factura aprobada. Ya puede emitirse.');
    });
  },

  /** Rechazo en revisión o aprobación (en aprobación, solo por un aprobador autorizado). */
  async rechazar(id: number, raw: unknown) {
    const input = motivoCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const tx = facturaEspecialTx(connection);
      const fe = await cargar(connection, id);
      if (!['PENDIENTE_REVISION', 'PENDIENTE_APROBACION'].includes(fe.estado)) throw new CxpError('Solo se rechazan facturas en revisión o pendientes de aprobación.', 409);
      if (fe.estado === 'PENDIENTE_APROBACION') {
        const autorizado = await tx.aprobadorAutorizado(input.usuario);
        if (!autorizado) throw new CxpError('El usuario no está autorizado para rechazar en la etapa de aprobación.', 403);
        const ahora = cxpNow();
        await aprobaciones.bind(connection).create({
          idDocumento: fe.idDocumento, nivel: 1, idRolAprobador: autorizado.idRol, idUsuarioAprobador: input.usuario,
          estado: 'RECHAZADA', accion: 'RECHAZAR_FACTURA_ESPECIAL', fechaSolicitud: ahora, fechaDecision: ahora, observacion: input.motivo,
        });
      }
      await cambiarEstado(connection, fe, 'RECHAZADA', { motivoRechazo: input.motivo }, input.usuario);
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_RECHAZO', asunto: `Factura especial ${numero(fe)} rechazada`, anterior: fe.estado, nuevo: 'RECHAZADA',
        usuario: input.usuario, detalle: input.motivo,
      });
      return resultado(connection, fe.idDocumento, 'Factura rechazada.');
    });
  },

  /** RECHAZADA → PREPARACIÓN para corregirla; requerirá una nueva revisión y aprobación. */
  async reabrir(id: number, raw: unknown) {
    const input = accionCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const fe = await cargar(connection, id);
      if (fe.estado !== 'RECHAZADA') throw new CxpError('Solo se reabren facturas rechazadas.', 409);
      await cambiarEstado(connection, fe, 'BORRADOR', {}, input.usuario);
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_REAPERTURA', asunto: `Factura especial ${numero(fe)} reabierta para corrección`, anterior: fe.estado, nuevo: 'BORRADOR',
        usuario: input.usuario, detalle: input.observacion ?? undefined,
      });
      return resultado(connection, fe.idDocumento, 'Factura reabierta en preparación.');
    });
  },

  /**
   * EMISIÓN: exige aprobación, asigna la constancia desde el correlativo bloqueado,
   * aplica los tributos y deja el documento pendiente de pago. Todo en una transacción:
   * la fila bloqueada y la condición ESTADO_EMISION = 'PENDIENTE' impiden emitir dos veces.
   */
  async emitir(id: number, raw: unknown) {
    const input = accionCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const tx = facturaEspecialTx(connection);
      const fe = await cargar(connection, id);
      if (fe.estadoEmision === 'EMITIDA') throw new CxpError(`La factura ya fue emitida con la constancia ${fe.numeroConstancia}; no puede emitirse dos veces.`, 409);
      if (fe.estadoEmision === 'ANULADA' || fe.estado === 'ANULADA') throw new CxpError('La factura está anulada y no puede emitirse.', 409);
      if (fe.estado !== 'APROBADA') throw new CxpError(`La factura no está aprobada (etapa actual: ${label(fe.etapa)}). Debe aprobarse antes de emitirse.`, 409);
      const tributos = await tx.tributos(fe.idDocumento);
      for (const tributo of tributos) {
        const regla = tributo.idReglaTributaria ? await reglaTributariaTx(connection).findById(tributo.idReglaTributaria) : null;
        if (!regla || regla.vigenteDesde > fe.fechaDocumento || (regla.vigenteHasta && regla.vigenteHasta < fe.fechaDocumento)) {
          throw new CxpError(`El tributo ${tributo.codigoTributo} no corresponde a una regla vigente en la fecha de la operación.`, 409);
        }
      }
      const correlativo = await tx.siguienteCorrelativo('CORRELATIVO_CONSTANCIA');
      const fechaEmision = cxpNow();
      const numeroConstancia = `CFE-${fechaEmision.slice(0, 4)}-${String(correlativo).padStart(6, '0')}`;
      const hash = huellaEmision(fe, tributos, numeroConstancia, fechaEmision, input.usuario);
      if (!await tx.emitir(fe.idDocumento, { numeroConstancia, fechaEmision, emitidoPor: input.usuario, hash })) {
        throw new CxpError('La factura ya fue emitida por otra operación.', 409);
      }
      await tx.actualizarTributos(fe.idDocumento, 'APLICADO', numeroConstancia);
      await cambiarEstado(connection, fe, 'PENDIENTE_PAGO', {}, input.usuario);
      const emitida = (await tx.find(fe.idDocumento))!;
      await registrarArchivoConstancia(connection, emitida, input.usuario);
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_EMISION', asunto: `Factura especial ${numero(fe)} emitida · constancia ${numeroConstancia}`, anterior: fe.estado,
        nuevo: 'PENDIENTE_PAGO', usuario: input.usuario, monto: fe.totalNeto,
        detalle: `Retenciones ${fe.retencionTotal} ${fe.moneda}; código de verificación ${hash}.`,
      });
      return resultado(connection, fe.idDocumento, `Factura emitida con la constancia ${numeroConstancia}.`);
    });
  },

  /**
   * ANULACIÓN: conserva el documento, sus tributos y la constancia (marcados como
   * anulados) y registra motivo, responsable, fecha, estado anterior y nuevo.
   */
  async anular(id: number, raw: unknown) {
    const input = motivoCxpFacturaEspecialSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const tx = facturaEspecialTx(connection);
      const fe = await cargar(connection, id);
      if (fe.etapa === 'ANULADA') throw new CxpError('La factura ya está anulada.', 409);
      if (fe.montoAplicado > 0) throw new CxpError('La factura tiene pagos aplicados; revierte esas aplicaciones antes de anularla.', 409);
      const estadoContable = ['CONTABILIZADO', 'ENVIADO'].includes(fe.estadoContable) ? 'REVERTIDO' : fe.estadoContable;
      const fechaAnulacion = cxpNow();
      await cambiarEstado(connection, fe, 'ANULADA', {
        motivoAnulacion: input.motivo, anuladoPor: input.usuario, fechaAnulacion, estadoContable,
        // Libera la clave de origen para poder registrar de nuevo la operación correcta.
        hashOrigen: null,
      }, input.usuario);
      await tx.actualizarTributos(fe.idDocumento, 'ANULADO');
      await tx.anularExtension(fe.idDocumento);
      const anulada = (await tx.find(fe.idDocumento))!;
      if (fe.numeroConstancia) await registrarArchivoConstancia(connection, anulada, input.usuario);
      const efectos = [
        `Tributos marcados ANULADO (impuestos ${fe.impuestoTotal}, retenciones ${fe.retencionTotal} ${fe.moneda}); se excluyen de las retenciones del periodo ${fe.fechaDocumento.slice(0, 7)}.`,
        fe.numeroConstancia ? `Constancia ${fe.numeroConstancia} conservada y marcada como anulada (nueva versión del archivo).` : 'Sin constancia emitida.',
        estadoContable !== fe.estadoContable ? `Estado contable ${fe.estadoContable} → ${estadoContable}: requiere partida de reversión.` : `Estado contable sin cambios (${fe.estadoContable}).`,
      ];
      await evento(connection, fe.idDocumento, {
        tipo: 'FE_ANULACION', asunto: `Factura especial ${numero(fe)} anulada`, anterior: fe.estado, nuevo: 'ANULADA',
        usuario: input.usuario, monto: fe.totalNeto, detalle: `Motivo: ${input.motivo}. Efectos: ${efectos.join(' ')}`,
      });
      return resultado(connection, fe.idDocumento, 'Factura anulada. El historial y la constancia se conservan.');
    });
  },

  /** Constancia PDF de una factura emitida (o anulada después de emitirse). */
  async constancia(id: number): Promise<{ nombre: string; pdf: Buffer }> {
    const connection = await getConnection();
    try {
      const fe = await facturaEspecialTx(connection).find(validId(id));
      if (!fe) throw new CxpError('Factura especial no encontrada', 404);
      if (!fe.numeroConstancia) throw new CxpError('La factura aún no ha sido emitida; la constancia se genera al emitirla.', 409);
      const pdf = buildConstanciaPdf(await datosConstancia(connection, fe));
      return { nombre: `constancia-${fe.numeroConstancia}${fe.etapa === 'ANULADA' ? '-anulada' : ''}.pdf`, pdf };
    } finally {
      await connection.close();
    }
  },
};
