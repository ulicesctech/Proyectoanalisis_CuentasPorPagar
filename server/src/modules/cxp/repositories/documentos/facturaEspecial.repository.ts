import oracledb, { type Connection } from 'oracledb';
import {
  cxpEtapaFacturaEspecial, cxpNow,
  type CxpFacturaEspecialAprobacion, type CxpFacturaEspecialMovimiento, type CxpFacturaEspecialResumen,
  type CxpFacturaEspecialTributo, type CxpTributoCalculado,
} from '@erp/contracts';
import { getConnection } from '../../../../config/database';

const OPTIONS = { outFormat: oracledb.OUT_FORMAT_OBJECT };
type Row = Record<string, string | number | null>;

const num = (value: unknown) => (value == null ? null : Number(value));
const str = (value: unknown) => (value == null ? null : String(value));

/** Columnas del documento + su extensión de factura especial. */
const COLUMNS = `D.ID_DOCUMENTO, F.ID_FACTURA_ESPECIAL, D.SERIE, D.NUMERO_DOCUMENTO, D.ID_PROVEEDOR, D.ID_SUCURSAL,
  F.PROVEEDOR_NOMBRE, F.PROVEEDOR_NIT, F.PROVEEDOR_CUI, F.PROVEEDOR_DIRECCION, F.DESCRIPCION_OPERACION,
  TO_CHAR(D.FECHA_DOCUMENTO, 'YYYY-MM-DD') AS FECHA_DOCUMENTO, TO_CHAR(D.FECHA_VENCIMIENTO, 'YYYY-MM-DD') AS FECHA_VENCIMIENTO,
  D.MONEDA, D.TIPO_CAMBIO, D.SUBTOTAL, D.DESCUENTO_TOTAL, D.IMPUESTO_TOTAL, D.RETENCION_TOTAL, D.TOTAL_BRUTO, D.TOTAL_NETO,
  D.TOTAL_LOCAL, D.MONTO_APLICADO, D.SALDO_PENDIENTE, D.REFERENCIA_EXTERNA, D.ID_DEPARTAMENTO, D.CENTRO_COSTO,
  D.CUENTA_CONTABLE, D.OBSERVACIONES, D.ESTADO, D.ESTADO_CONTABLE, D.MOTIVO_RECHAZO, D.MOTIVO_ANULACION, D.ANULADO_POR,
  TO_CHAR(D.FECHA_ANULACION, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_ANULACION, D.CREADO_POR,
  TO_CHAR(D.FECHA_CREACION, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_CREACION,
  F.REVISADO_POR, TO_CHAR(F.FECHA_REVISION, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_REVISION, F.OBSERVACION_REVISION,
  F.ESTADO_EMISION, F.NUMERO_CONSTANCIA, TO_CHAR(F.FECHA_EMISION, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_EMISION,
  F.EMITIDO_POR, F.HASH_CONSTANCIA`;

const FROM = `FROM CXP_DOCUMENTO D JOIN CXP_FACTURA_ESPECIAL F ON F.ID_DOCUMENTO = D.ID_DOCUMENTO
  WHERE D.TIPO_DOCUMENTO = 'FACTURA_ESPECIAL'`;

export type FacturaEspecialRow = ReturnType<typeof mapRow>;

function mapRow(row: Row) {
  const resumen: CxpFacturaEspecialResumen = {
    idDocumento: Number(row.ID_DOCUMENTO), idFacturaEspecial: Number(row.ID_FACTURA_ESPECIAL),
    serie: String(row.SERIE ?? ''), numeroDocumento: String(row.NUMERO_DOCUMENTO ?? ''),
    idProveedor: Number(row.ID_PROVEEDOR), proveedorNombre: String(row.PROVEEDOR_NOMBRE),
    proveedorNit: str(row.PROVEEDOR_NIT), proveedorCui: str(row.PROVEEDOR_CUI),
    fechaDocumento: String(row.FECHA_DOCUMENTO), moneda: String(row.MONEDA),
    subtotal: Number(row.SUBTOTAL), impuestoTotal: Number(row.IMPUESTO_TOTAL), retencionTotal: Number(row.RETENCION_TOTAL),
    totalNeto: Number(row.TOTAL_NETO), estado: String(row.ESTADO),
    estadoEmision: row.ESTADO_EMISION as CxpFacturaEspecialResumen['estadoEmision'],
    etapa: cxpEtapaFacturaEspecial(String(row.ESTADO), String(row.ESTADO_EMISION)),
    numeroConstancia: str(row.NUMERO_CONSTANCIA), fechaEmision: str(row.FECHA_EMISION),
  };
  return {
    ...resumen,
    idSucursal: Number(row.ID_SUCURSAL), tipoCambio: Number(row.TIPO_CAMBIO), descuentoTotal: Number(row.DESCUENTO_TOTAL),
    totalBruto: Number(row.TOTAL_BRUTO), totalLocal: Number(row.TOTAL_LOCAL), montoAplicado: Number(row.MONTO_APLICADO),
    saldoPendiente: Number(row.SALDO_PENDIENTE), referenciaExterna: str(row.REFERENCIA_EXTERNA),
    fechaVencimiento: str(row.FECHA_VENCIMIENTO), idDepartamento: num(row.ID_DEPARTAMENTO), centroCosto: str(row.CENTRO_COSTO),
    cuentaContable: str(row.CUENTA_CONTABLE), proveedorDireccion: str(row.PROVEEDOR_DIRECCION),
    descripcionOperacion: String(row.DESCRIPCION_OPERACION), observaciones: str(row.OBSERVACIONES),
    estadoContable: String(row.ESTADO_CONTABLE), motivoRechazo: str(row.MOTIVO_RECHAZO), motivoAnulacion: str(row.MOTIVO_ANULACION),
    anuladoPor: num(row.ANULADO_POR), fechaAnulacion: str(row.FECHA_ANULACION), revisadoPor: num(row.REVISADO_POR),
    fechaRevision: str(row.FECHA_REVISION), observacionRevision: str(row.OBSERVACION_REVISION), emitidoPor: num(row.EMITIDO_POR),
    hashConstancia: str(row.HASH_CONSTANCIA), creadoPor: Number(row.CREADO_POR), fechaCreacion: String(row.FECHA_CREACION),
  };
}

export async function listFacturasEspeciales(params: { page: number; limit: number; search?: string; etapa?: string; idProveedor?: number }) {
  const connection = await getConnection();
  try {
    const clauses: string[] = [];
    const binds: oracledb.BindParameters = {};
    if (params.search) {
      clauses.push(`(UPPER(D.SERIE || '-' || D.NUMERO_DOCUMENTO) LIKE UPPER(:search) OR UPPER(F.PROVEEDOR_NOMBRE) LIKE UPPER(:search)
        OR UPPER(NVL(F.PROVEEDOR_NIT, F.PROVEEDOR_CUI)) LIKE UPPER(:search) OR UPPER(F.NUMERO_CONSTANCIA) LIKE UPPER(:search)
        OR UPPER(D.REFERENCIA_EXTERNA) LIKE UPPER(:search))`);
      binds.search = `%${params.search}%`;
    }
    if (params.idProveedor) { clauses.push('D.ID_PROVEEDOR = :idProveedor'); binds.idProveedor = params.idProveedor; }
    // Misma derivación que cxpEtapaFacturaEspecial, expresada en SQL para filtrar y paginar en la base.
    const etapas: Record<string, string> = {
      PREPARACION: `D.ESTADO NOT IN ('PENDIENTE_REVISION', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'ANULADA') AND F.ESTADO_EMISION = 'PENDIENTE'`,
      REVISION: `D.ESTADO = 'PENDIENTE_REVISION' AND F.ESTADO_EMISION = 'PENDIENTE'`,
      APROBACION: `D.ESTADO = 'PENDIENTE_APROBACION' AND F.ESTADO_EMISION = 'PENDIENTE'`,
      APROBADA: `D.ESTADO = 'APROBADA' AND F.ESTADO_EMISION = 'PENDIENTE'`,
      RECHAZADA: `D.ESTADO = 'RECHAZADA' AND F.ESTADO_EMISION = 'PENDIENTE'`,
      EMITIDA: `F.ESTADO_EMISION = 'EMITIDA' AND D.ESTADO <> 'ANULADA'`,
      ANULADA: `(D.ESTADO = 'ANULADA' OR F.ESTADO_EMISION = 'ANULADA')`,
      BANDEJA: `D.ESTADO IN ('PENDIENTE_REVISION', 'PENDIENTE_APROBACION') AND F.ESTADO_EMISION = 'PENDIENTE'`,
    };
    if (params.etapa) clauses.push(`(${etapas[params.etapa]})`);
    const where = clauses.length ? ` AND ${clauses.join(' AND ')}` : '';
    const rows = await connection.execute<Row>(
      `SELECT ${COLUMNS} ${FROM}${where} ORDER BY D.ID_DOCUMENTO DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...binds, offset: (params.page - 1) * params.limit, limit: params.limit }, OPTIONS);
    const count = await connection.execute<{ TOTAL: number }>(`SELECT COUNT(*) AS TOTAL ${FROM}${where}`, binds, OPTIONS);
    return { data: (rows.rows ?? []).map(row => { const { idDocumento, idFacturaEspecial, serie, numeroDocumento, idProveedor, proveedorNombre, proveedorNit, proveedorCui,
      fechaDocumento, moneda, subtotal, impuestoTotal, retencionTotal, totalNeto, estado, estadoEmision, etapa, numeroConstancia, fechaEmision } = mapRow(row);
      return { idDocumento, idFacturaEspecial, serie, numeroDocumento, idProveedor, proveedorNombre, proveedorNit, proveedorCui,
        fechaDocumento, moneda, subtotal, impuestoTotal, retencionTotal, totalNeto, estado, estadoEmision, etapa, numeroConstancia, fechaEmision }; }),
    total: count.rows?.[0]?.TOTAL ?? 0 };
  } finally {
    await connection.close();
  }
}

export function facturaEspecialTx(connection: Connection) {
  return {
    /** Documento + extensión; con lock=true bloquea ambas filas para operaciones de flujo. */
    async find(idDocumento: number, lock = false) {
      const result = await connection.execute<Row>(
        `SELECT ${COLUMNS} ${FROM} AND D.ID_DOCUMENTO = :id${lock ? ' FOR UPDATE' : ''}`, { id: idDocumento }, OPTIONS);
      return result.rows?.[0] ? mapRow(result.rows[0]) : null;
    },

    async existeReferencia(idProveedor: number, referencia: string, excluirDocumento?: number): Promise<string | null> {
      const result = await connection.execute<{ NUMERO: string }>(
        `SELECT D.SERIE || '-' || D.NUMERO_DOCUMENTO AS NUMERO FROM CXP_DOCUMENTO D
          WHERE D.TIPO_DOCUMENTO = 'FACTURA_ESPECIAL' AND D.ESTADO <> 'ANULADA' AND D.ID_PROVEEDOR = :idProveedor
            AND UPPER(TRIM(D.REFERENCIA_EXTERNA)) = UPPER(TRIM(:referencia)) AND D.ID_DOCUMENTO <> NVL(:excluir, -1)
          FETCH FIRST 1 ROWS ONLY`,
        { idProveedor, referencia, excluir: excluirDocumento ?? null }, OPTIONS);
      return result.rows?.[0]?.NUMERO ?? null;
    },

    async proveedor(idProveedor: number): Promise<{ nombre: string; nit: string | null } | null> {
      const result = await connection.execute<{ NOMBRE: string; NIT: string | null }>(
        'SELECT PRO_NOMBRE_ENTIDAD AS NOMBRE, PRO_NIT AS NIT FROM PROVEEDOR WHERE PRO_ID_PROVEEDOR = :id', { id: idProveedor }, OPTIONS);
      const row = result.rows?.[0];
      return row ? { nombre: row.NOMBRE, nit: row.NIT } : null;
    },

    /** Parámetro de configuración del módulo (CXP_PARAMETRO). */
    async parametro(grupo: string, codigo: string, lock = false): Promise<{ id: number; texto: string | null; numero: number | null; activo: string } | null> {
      const result = await connection.execute<Row>(
        `SELECT ID_PARAMETRO, VALOR_TEXTO, VALOR_NUMERO, ACTIVO FROM CXP_PARAMETRO
          WHERE GRUPO_PARAMETRO = :grupo AND CODIGO = :codigo${lock ? ' FOR UPDATE' : ''}`, { grupo, codigo }, OPTIONS);
      const row = result.rows?.[0];
      return row ? { id: Number(row.ID_PARAMETRO), texto: str(row.VALOR_TEXTO), numero: num(row.VALOR_NUMERO), activo: String(row.ACTIVO).trim() } : null;
    },

    /**
     * Siguiente número del correlativo. La fila queda bloqueada hasta el COMMIT, así dos
     * operaciones concurrentes no obtienen el mismo número y un ROLLBACK no deja huecos.
     */
    async siguienteCorrelativo(codigo: 'CORRELATIVO_FACTURA' | 'CORRELATIVO_CONSTANCIA'): Promise<number> {
      const actual = await this.parametro('CXP_FACTURA_ESPECIAL', codigo, true);
      if (!actual || actual.activo !== 'S') throw new Error(`Falta el parámetro activo CXP_FACTURA_ESPECIAL/${codigo}. Aplica la migración 001.`);
      const siguiente = Number(actual.numero ?? 0) + 1;
      await connection.execute(
        `UPDATE CXP_PARAMETRO SET VALOR_NUMERO = :siguiente, FECHA_MODIFICACION = SYSTIMESTAMP WHERE ID_PARAMETRO = :id`,
        { siguiente, id: actual.id });
      return siguiente;
    },

    async aprobadorAutorizado(idUsuario: number): Promise<{ idRol: number } | null> {
      const result = await connection.execute<{ ROL: string | null }>(
        `SELECT VALOR_TEXTO AS ROL FROM CXP_PARAMETRO
          WHERE GRUPO_PARAMETRO = 'CXP_FE_APROBADOR' AND VALOR_NUMERO = :idUsuario AND ACTIVO = 'S'
          FETCH FIRST 1 ROWS ONLY`, { idUsuario }, OPTIONS);
      const rol = Number(result.rows?.[0]?.ROL);
      return result.rows?.length && Number.isSafeInteger(rol) && rol > 0 ? { idRol: rol } : null;
    },

    async insertExtension(data: { idDocumento: number; proveedorNombre: string; proveedorNit: string | null; proveedorCui: string | null;
      proveedorDireccion: string | null; descripcionOperacion: string; creadoPor: number }) {
      await connection.execute(
        `INSERT INTO CXP_FACTURA_ESPECIAL (ID_DOCUMENTO, PROVEEDOR_NOMBRE, PROVEEDOR_NIT, PROVEEDOR_CUI, PROVEEDOR_DIRECCION,
            DESCRIPCION_OPERACION, ESTADO_EMISION, CREADO_POR, FECHA_CREACION)
         VALUES (:idDocumento, :proveedorNombre, :proveedorNit, :proveedorCui, :proveedorDireccion, :descripcionOperacion, 'PENDIENTE', :creadoPor,
            TO_TIMESTAMP(:ahora, 'YYYY-MM-DD"T"HH24:MI:SS'))`,
        { ...data, ahora: cxpNow() });
    },

    async updateExtension(idDocumento: number, data: { proveedorNombre: string; proveedorNit: string | null; proveedorCui: string | null;
      proveedorDireccion: string | null; descripcionOperacion: string }) {
      await connection.execute(
        `UPDATE CXP_FACTURA_ESPECIAL SET PROVEEDOR_NOMBRE = :proveedorNombre, PROVEEDOR_NIT = :proveedorNit, PROVEEDOR_CUI = :proveedorCui,
            PROVEEDOR_DIRECCION = :proveedorDireccion, DESCRIPCION_OPERACION = :descripcionOperacion
          WHERE ID_DOCUMENTO = :idDocumento AND ESTADO_EMISION = 'PENDIENTE'`,
        { ...data, idDocumento });
    },

    async registrarRevision(idDocumento: number, usuario: number, observacion: string | null) {
      await connection.execute(
        `UPDATE CXP_FACTURA_ESPECIAL SET REVISADO_POR = :usuario, OBSERVACION_REVISION = :observacion,
            FECHA_REVISION = TO_TIMESTAMP(:ahora, 'YYYY-MM-DD"T"HH24:MI:SS')
          WHERE ID_DOCUMENTO = :idDocumento`, { usuario, observacion, idDocumento, ahora: cxpNow() });
    },

    /** Marca la emisión solo si sigue pendiente: una segunda emisión no afecta filas. */
    async emitir(idDocumento: number, data: { numeroConstancia: string; fechaEmision: string; emitidoPor: number; hash: string }): Promise<boolean> {
      const result = await connection.execute(
        `UPDATE CXP_FACTURA_ESPECIAL SET ESTADO_EMISION = 'EMITIDA', NUMERO_CONSTANCIA = :numeroConstancia,
            FECHA_EMISION = TO_TIMESTAMP(:fechaEmision, 'YYYY-MM-DD"T"HH24:MI:SS'), EMITIDO_POR = :emitidoPor, HASH_CONSTANCIA = :hash
          WHERE ID_DOCUMENTO = :idDocumento AND ESTADO_EMISION = 'PENDIENTE'`,
        { ...data, idDocumento });
      return result.rowsAffected === 1;
    },

    async anularExtension(idDocumento: number) {
      await connection.execute(`UPDATE CXP_FACTURA_ESPECIAL SET ESTADO_EMISION = 'ANULADA' WHERE ID_DOCUMENTO = :idDocumento`, { idDocumento });
    },

    async tributos(idDocumento: number): Promise<CxpFacturaEspecialTributo[]> {
      const result = await connection.execute<Row>(
        `SELECT T.ID_TRIBUTO, T.ID_REGLA_TRIBUTARIA, R.CODIGO_REGLA, R.VERSION_REGLA, T.TIPO_TRIBUTO, T.CODIGO_TRIBUTO,
                T.NOMBRE_TRIBUTO, T.BASE_IMPONIBLE, T.PORCENTAJE, T.MONTO, T.NUMERO_CONSTANCIA, T.PERIODO_FISCAL,
                TO_CHAR(T.FECHA_APLICACION, 'YYYY-MM-DD') AS FECHA_APLICACION, T.ESTADO
           FROM CXP_DOCUMENTO_TRIBUTO T LEFT JOIN CXP_REGLA_TRIBUTARIA R ON R.ID_REGLA_TRIBUTARIA = T.ID_REGLA_TRIBUTARIA
          WHERE T.ID_DOCUMENTO = :idDocumento ORDER BY T.TIPO_TRIBUTO, T.CODIGO_TRIBUTO`, { idDocumento }, OPTIONS);
      return (result.rows ?? []).map(row => ({
        idTributo: Number(row.ID_TRIBUTO), idReglaTributaria: num(row.ID_REGLA_TRIBUTARIA), codigoRegla: str(row.CODIGO_REGLA),
        versionRegla: num(row.VERSION_REGLA), tipoTributo: String(row.TIPO_TRIBUTO), codigoTributo: String(row.CODIGO_TRIBUTO),
        nombreTributo: String(row.NOMBRE_TRIBUTO), baseImponible: Number(row.BASE_IMPONIBLE), porcentaje: Number(row.PORCENTAJE),
        monto: Number(row.MONTO), numeroConstancia: str(row.NUMERO_CONSTANCIA), periodoFiscal: str(row.PERIODO_FISCAL),
        fechaAplicacion: String(row.FECHA_APLICACION), estado: String(row.ESTADO),
      }));
    },

    /** Solo mientras la factura está en preparación: los tributos se recalculan con las reglas vigentes. */
    async reemplazarTributosCalculados(idDocumento: number, fecha: string, tributos: CxpTributoCalculado[], usuario: number) {
      await connection.execute(`DELETE FROM CXP_DOCUMENTO_TRIBUTO WHERE ID_DOCUMENTO = :idDocumento AND ESTADO = 'CALCULADO'`, { idDocumento });
      for (const tributo of tributos) {
        await connection.execute(
          `INSERT INTO CXP_DOCUMENTO_TRIBUTO (ID_DOCUMENTO, TIPO_TRIBUTO, CODIGO_TRIBUTO, NOMBRE_TRIBUTO, BASE_IMPONIBLE,
              PORCENTAJE, MONTO, INCLUIDO_PRECIO, PERIODO_FISCAL, FECHA_APLICACION, ESTADO, GENERADO_POR, ID_REGLA_TRIBUTARIA)
           VALUES (:idDocumento, :tipoTributo, :codigoTributo, :nombreTributo, :baseImponible, :porcentaje, :monto, 'N',
              :periodoFiscal, TO_DATE(:fecha, 'YYYY-MM-DD'), 'CALCULADO', :usuario, :idReglaTributaria)`,
          {
            idDocumento, tipoTributo: tributo.tipoTributo, codigoTributo: tributo.codigoTributo, nombreTributo: tributo.nombreTributo,
            baseImponible: tributo.baseImponible, porcentaje: tributo.porcentaje, monto: tributo.monto,
            periodoFiscal: fecha.slice(0, 7), fecha, usuario, idReglaTributaria: tributo.idReglaTributaria,
          });
      }
    },

    async actualizarTributos(idDocumento: number, estado: 'APLICADO' | 'ANULADO', numeroConstancia?: string) {
      await connection.execute(
        `UPDATE CXP_DOCUMENTO_TRIBUTO SET ESTADO = :estado, NUMERO_CONSTANCIA = NVL(:numeroConstancia, NUMERO_CONSTANCIA)
          WHERE ID_DOCUMENTO = :idDocumento`, { estado, numeroConstancia: numeroConstancia ?? null, idDocumento });
    },

    async aprobaciones(idDocumento: number): Promise<CxpFacturaEspecialAprobacion[]> {
      const result = await connection.execute<Row>(
        `SELECT ID_APROBACION, NIVEL, ESTADO, ID_USUARIO_APROBADOR,
                TO_CHAR(FECHA_SOLICITUD, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_SOLICITUD,
                TO_CHAR(FECHA_DECISION, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_DECISION, OBSERVACION
           FROM CXP_APROBACION WHERE ID_DOCUMENTO = :idDocumento ORDER BY ID_APROBACION`, { idDocumento }, OPTIONS);
      return (result.rows ?? []).map(row => ({
        idAprobacion: Number(row.ID_APROBACION), nivel: Number(row.NIVEL), estado: String(row.ESTADO),
        idUsuarioAprobador: num(row.ID_USUARIO_APROBADOR), usuarioAprobador: null, fechaSolicitud: String(row.FECHA_SOLICITUD),
        fechaDecision: str(row.FECHA_DECISION), observacion: str(row.OBSERVACION),
      }));
    },

    async historial(idDocumento: number): Promise<CxpFacturaEspecialMovimiento[]> {
      const result = await connection.execute<Row>(
        `SELECT ID_EVENTO, TIPO_EVENTO, ASUNTO, DETALLE, ESTADO_ANTERIOR, ESTADO_NUEVO, MONTO_RELACIONADO, USUARIO_EVENTO,
                TO_CHAR(FECHA_EVENTO, 'YYYY-MM-DD"T"HH24:MI:SS') AS FECHA_EVENTO
           FROM CXP_EVENTO WHERE ID_DOCUMENTO = :idDocumento ORDER BY FECHA_EVENTO, ID_EVENTO`, { idDocumento }, OPTIONS);
      return (result.rows ?? []).map(row => ({
        idEvento: Number(row.ID_EVENTO), tipoEvento: String(row.TIPO_EVENTO), asunto: String(row.ASUNTO), detalle: str(row.DETALLE),
        estadoAnterior: str(row.ESTADO_ANTERIOR), estadoNuevo: str(row.ESTADO_NUEVO), montoRelacionado: num(row.MONTO_RELACIONADO),
        usuarioEvento: Number(row.USUARIO_EVENTO), usuario: null, fechaEvento: String(row.FECHA_EVENTO),
      }));
    },

    async archivoConstanciaActual(idDocumento: number): Promise<{ id: number; version: number } | null> {
      const result = await connection.execute<{ ID_ARCHIVO: number; VERSION_ARCHIVO: number }>(
        `SELECT ID_ARCHIVO, VERSION_ARCHIVO FROM CXP_ARCHIVO
          WHERE ID_DOCUMENTO = :idDocumento AND CATEGORIA = 'CONSTANCIA_FE' AND ES_VERSION_ACTUAL = 'S' FOR UPDATE`,
        { idDocumento }, OPTIONS);
      const row = result.rows?.[0];
      return row ? { id: Number(row.ID_ARCHIVO), version: Number(row.VERSION_ARCHIVO) } : null;
    },

    async desactivarArchivo(idArchivo: number) {
      await connection.execute(`UPDATE CXP_ARCHIVO SET ES_VERSION_ACTUAL = 'N' WHERE ID_ARCHIVO = :idArchivo`, { idArchivo });
    },
  };
}
