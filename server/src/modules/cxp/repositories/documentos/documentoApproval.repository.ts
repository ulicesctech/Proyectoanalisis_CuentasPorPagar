import oracledb, { type Connection } from 'oracledb';
import type { CxpRecord } from '@erp/contracts';

type OracleRow = Record<string, string | number | Date | null>;

export type DocumentoApprovalRule = {
  idRegla: number;
  nombreRegla: string;
  idProveedor: number | null;
  idDepartamento: number | null;
  centroCosto: string | null;
  proyecto: string | null;
  moneda: string | null;
  montoDesde: number;
  montoHasta: number | null;
  requiereSinOc: string | null;
  requiereDiferencia: string | null;
  nivel: number;
  idRolAprobador: number;
  cantidadAprobadores: number;
};

export type DocumentoApprovalDecision = {
  idAprobacion: number;
  idRegla: number | null;
  nivel: number;
  idRolAprobador: number;
  idUsuarioAprobador: number | null;
  estado: string;
  accion: string | null;
  fechaDecision: string | null;
  observacion: string | null;
};

export type ApprovalActor = {
  idUsuario: number;
  nombre: string | null;
  idRol: number | null;
  usuarioActivo: boolean;
  rolActivo: boolean;
};

function rule(row: OracleRow): DocumentoApprovalRule {
  return {
    idRegla: Number(row.ID_REGLA), nombreRegla: String(row.NOMBRE_REGLA),
    idProveedor: row.ID_PROVEEDOR == null ? null : Number(row.ID_PROVEEDOR),
    idDepartamento: row.ID_DEPARTAMENTO == null ? null : Number(row.ID_DEPARTAMENTO),
    centroCosto: row.CENTRO_COSTO == null ? null : String(row.CENTRO_COSTO),
    proyecto: row.PROYECTO == null ? null : String(row.PROYECTO),
    moneda: row.MONEDA == null ? null : String(row.MONEDA),
    montoDesde: Number(row.MONTO_DESDE), montoHasta: row.MONTO_HASTA == null ? null : Number(row.MONTO_HASTA),
    requiereSinOc: row.REQUIERE_SIN_OC == null ? null : String(row.REQUIERE_SIN_OC).trim(),
    requiereDiferencia: row.REQUIERE_DIFERENCIA == null ? null : String(row.REQUIERE_DIFERENCIA).trim(),
    nivel: Number(row.NIVEL), idRolAprobador: Number(row.ID_ROL_APROBADOR),
    cantidadAprobadores: Number(row.CANTIDAD_APROBADORES),
  };
}

function decision(row: OracleRow): DocumentoApprovalDecision {
  return {
    idAprobacion: Number(row.ID_APROBACION), idRegla: row.ID_REGLA == null ? null : Number(row.ID_REGLA),
    nivel: Number(row.NIVEL), idRolAprobador: Number(row.ID_ROL_APROBADOR),
    idUsuarioAprobador: row.ID_USUARIO_APROBADOR == null ? null : Number(row.ID_USUARIO_APROBADOR),
    estado: String(row.ESTADO), accion: row.ACCION == null ? null : String(row.ACCION),
    fechaDecision: row.FECHA_DECISION == null ? null : String(row.FECHA_DECISION),
    observacion: row.OBSERVACION == null ? null : String(row.OBSERVACION),
  };
}

export async function listActiveDocumentoApprovalRules(connection: Connection): Promise<DocumentoApprovalRule[]> {
  const result = await connection.execute<OracleRow>(
    `SELECT ID_REGLA, NOMBRE_REGLA, ID_PROVEEDOR, ID_DEPARTAMENTO, CENTRO_COSTO, PROYECTO,
            MONEDA, MONTO_DESDE, MONTO_HASTA, REQUIERE_SIN_OC, REQUIERE_DIFERENCIA,
            NIVEL, ID_ROL_APROBADOR, CANTIDAD_APROBADORES
       FROM CXP_REGLA_APROBACION
      WHERE TIPO_ENTIDAD = 'DOCUMENTO' AND ACTIVA = 'S'
        AND TRUNC(VIGENTE_DESDE) <= TRUNC(SYSDATE)
        AND (VIGENTE_HASTA IS NULL OR TRUNC(VIGENTE_HASTA) >= TRUNC(SYSDATE))
      ORDER BY NIVEL, ID_REGLA`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return (result.rows ?? []).map(rule);
}

export async function listDocumentoApprovalDecisions(connection: Connection, idDocumento: number): Promise<DocumentoApprovalDecision[]> {
  const result = await connection.execute<OracleRow>(
    `SELECT ID_APROBACION, ID_REGLA, NIVEL, ID_ROL_APROBADOR, ID_USUARIO_APROBADOR,
            ESTADO, ACCION, TO_CHAR(FECHA_DECISION, 'YYYY-MM-DD"T"HH24:MI:SS.FF6') AS FECHA_DECISION,
            OBSERVACION
       FROM CXP_APROBACION
      WHERE ID_DOCUMENTO = :idDocumento
      ORDER BY NIVEL, ID_APROBACION`, { idDocumento }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return (result.rows ?? []).map(decision);
}

export async function findApprovalActor(connection: Connection, idUsuario: number): Promise<ApprovalActor | null> {
  const result = await connection.execute<OracleRow>(
    `SELECT U.USU_ID_USUARIO, U.USU_NOMBRE_COMPLETO, U.USU_ID_ROL, U.USU_ACTIVO, R.ROL_ACTIVO
       FROM USUARIO U
       LEFT JOIN ROL R ON R.ROL_ID_ROL = U.USU_ID_ROL
      WHERE U.USU_ID_USUARIO = :idUsuario`, { idUsuario }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = result.rows?.[0];
  return row ? {
    idUsuario: Number(row.USU_ID_USUARIO), nombre: row.USU_NOMBRE_COMPLETO == null ? null : String(row.USU_NOMBRE_COMPLETO),
    idRol: row.USU_ID_ROL == null ? null : Number(row.USU_ID_ROL),
    usuarioActivo: Number(row.USU_ACTIVO) === 1, rolActivo: Number(row.ROL_ACTIVO) === 1,
  } : null;
}

export async function insertDocumentoApprovalDecision(connection: Connection, input: {
  idDocumento: number;
  idRegla: number;
  nivel: number;
  idRolAprobador: number;
  idUsuarioAprobador: number;
  estado: 'APROBADA' | 'RECHAZADA';
  accion: 'APROBAR' | 'RECHAZAR';
  observacion: string | null;
}): Promise<number> {
  const result = await connection.execute<{ id: number[] }>(
    `INSERT INTO CXP_APROBACION
       (ID_REGLA, ID_DOCUMENTO, NIVEL, ID_ROL_APROBADOR, ID_USUARIO_APROBADOR,
        ESTADO, ACCION, FECHA_DECISION, OBSERVACION)
     VALUES
       (:idRegla, :idDocumento, :nivel, :idRolAprobador, :idUsuarioAprobador,
        :estado, :accion, SYSTIMESTAMP, :observacion)
     RETURNING ID_APROBACION INTO :id`, {
      ...input,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  return result.outBinds!.id[0];
}

export function documentoMatchesApprovalRule(documento: CxpRecord, approvalRule: DocumentoApprovalRule): boolean {
  const totalLocal = Number(documento.totalLocal);
  if (!Number.isFinite(totalLocal) || totalLocal < approvalRule.montoDesde ||
      approvalRule.montoHasta != null && totalLocal > approvalRule.montoHasta) return false;
  if (approvalRule.idProveedor != null && Number(documento.idProveedor) !== approvalRule.idProveedor) return false;
  if (approvalRule.idDepartamento != null && Number(documento.idDepartamento) !== approvalRule.idDepartamento) return false;
  if (approvalRule.centroCosto != null && String(documento.centroCosto ?? '') !== approvalRule.centroCosto) return false;
  if (approvalRule.proyecto != null && String(documento.proyecto ?? '') !== approvalRule.proyecto) return false;
  if (approvalRule.moneda != null && String(documento.moneda ?? '') !== approvalRule.moneda) return false;
  const sinOc = documento.tipoRegistro === 'SIN_OC' ? 'S' : 'N';
  if (approvalRule.requiereSinOc != null && approvalRule.requiereSinOc !== sinOc) return false;
  const difference = ['diferenciaCantidad', 'diferenciaPrecio', 'diferenciaImpuesto', 'diferenciaTotal']
    .some(field => Math.abs(Number(documento[field] ?? 0)) > 0) ||
    !['NO_APLICA', 'COINCIDE'].includes(String(documento.resultadoTresVias));
  if (approvalRule.requiereDiferencia != null && approvalRule.requiereDiferencia !== (difference ? 'S' : 'N')) return false;
  return true;
}
