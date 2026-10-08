import oracledb, { type Connection } from 'oracledb';
import { CXP_WORKFLOWS, cxpAllowedStates, cxpBalanceStateIssue, cxpToday, type CxpRecord, type CxpResource } from '@erp/contracts';
import { CXP_TABLES } from '../repositories/definitions';
import { CxpError } from './errors';

const approvalTarget: Partial<Record<CxpResource, { tipoEntidad: string; approvalField: string; amountField: string }>> = {
  documentos: { tipoEntidad: 'DOCUMENTO', approvalField: 'idDocumento', amountField: 'totalNeto' },
  pagos: { tipoEntidad: 'PAGO', approvalField: 'idPago', amountField: 'montoObligacion' },
  'lotes-pago': { tipoEntidad: 'LOTE', approvalField: 'idLote', amountField: 'montoTotal' },
};

const label = (state: string) => state.replace(/_/g, ' ');

/** Valida el estado inicial de un registro nuevo. */
export function checkInitialState(resource: CxpResource, input: CxpRecord): void {
  const allowed = cxpAllowedStates(resource);
  if (allowed && input.estado != null && !allowed.includes(String(input.estado))) {
    throw new CxpError(`Un registro nuevo debe iniciar en uno de estos estados: ${allowed.map(label).join(', ')}`);
  }
  const issue = cxpBalanceStateIssue(resource, input);
  if (issue) throw new CxpError(issue, 409);
}

/** Valida el cambio de estado y el bloqueo de importes antes de guardar un PATCH. */
export function checkStateChange(resource: CxpResource, current: CxpRecord, next: CxpRecord): void {
  const workflow = CXP_WORKFLOWS[resource];
  if (!workflow) return;
  const from = String(current.estado);
  const to = String(next.estado);
  if (from !== to && !cxpAllowedStates(resource, from)!.includes(to)) {
    const options = workflow.transitions[from] ?? [];
    throw new CxpError(options.length
      ? `No se puede pasar de ${label(from)} a ${label(to)}. Estados permitidos: ${options.map(label).join(', ')}`
      : `El estado ${label(from)} es final y no admite cambios`, 409);
  }
  if (!workflow.editable.includes(from)) {
    const changed = workflow.lockedFields.filter(field => next[field] !== undefined && (next[field] ?? null) !== (current[field] ?? null) && Number(next[field]) !== Number(current[field]));
    if (changed.length) {
      throw new CxpError(`Los campos ${changed.join(', ')} solo se pueden modificar en estado ${workflow.editable.map(label).join(', ')}. Regresa el registro a ese estado para corregirlos y vuelve a solicitar aprobación`, 409);
    }
  }
  const issue = cxpBalanceStateIssue(resource, next);
  if (issue) throw new CxpError(issue, 409);
}

/** Los componentes de un documento (detalle, tributos) solo cambian mientras el documento es editable. */
export async function checkEditableParent(connection: Connection, resource: CxpResource, input: CxpRecord): Promise<void> {
  if (resource !== 'documentos-detalle' && resource !== 'documentos-tributos') return;
  const result = await connection.execute<{ ESTADO: string }>(
    `SELECT ESTADO FROM ${CXP_TABLES.documentos.table} WHERE ${CXP_TABLES.documentos.idColumn} = :id FOR UPDATE`,
    { id: Number(input.idDocumento) }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const estado = result.rows?.[0]?.ESTADO;
  if (!estado) throw new CxpError('El documento relacionado ya no existe', 400);
  if (!CXP_WORKFLOWS.documentos!.editable.includes(estado)) {
    throw new CxpError(`No se pueden modificar componentes de un documento en estado ${label(estado)}`, 409);
  }
}

interface RuleRow { NIVEL: number; CANTIDAD_APROBADORES: number; NOMBRE_REGLA: string }
interface ApprovalRow { NIVEL: number; ESTADO: string; TOTAL: number }

/**
 * Para pasar a APROBADA/APROBADO se exige que cada nivel de las reglas vigentes
 * aplicables tenga las aprobaciones requeridas y que no queden aprobaciones
 * pendientes. El rechazo del registro se expresa pasándolo a RECHAZADA/RECHAZADO.
 */
export async function checkApprovals(connection: Connection, resource: CxpResource, id: number, record: CxpRecord, previousState?: unknown): Promise<void> {
  const workflow = CXP_WORKFLOWS[resource];
  const target = approvalTarget[resource];
  if (!workflow || !target || !workflow.requiresApproval.includes(String(record.estado)) || previousState === record.estado) return;

  const rules = CXP_TABLES['reglas-aprobacion'].columns;
  const approvals = CXP_TABLES.aprobaciones.columns;
  const binds: oracledb.BindParameters = {
    tipoEntidad: target.tipoEntidad,
    monto: Number(record[target.amountField] ?? 0),
    moneda: (record.moneda as string | null) ?? null,
    idProveedor: (record.idProveedor as number | null) ?? null,
    idDepartamento: (record.idDepartamento as number | null) ?? null,
    centroCosto: (record.centroCosto as string | null) ?? null,
    proyecto: (record.proyecto as string | null) ?? null,
    sinOc: record.tipoRegistro === 'SIN_OC' ? 'S' : 'N',
    conDiferencia: record.resultadoTresVias && !['NO_APLICA', 'COINCIDE'].includes(String(record.resultadoTresVias)) ? 'S' : 'N',
    hoy: cxpToday(),
  };
  const required = await connection.execute<RuleRow>(
    `SELECT ${rules.nivel.column} AS NIVEL, MAX(${rules.cantidadAprobadores.column}) AS CANTIDAD_APROBADORES,
            MIN(${rules.nombreRegla.column}) AS NOMBRE_REGLA
       FROM ${CXP_TABLES['reglas-aprobacion'].table}
      WHERE ${rules.tipoEntidad.column} = :tipoEntidad AND ${rules.activa.column} = 'S'
        AND ${rules.vigenteDesde.column} <= TO_DATE(:hoy, 'YYYY-MM-DD')
        AND (${rules.vigenteHasta.column} IS NULL OR ${rules.vigenteHasta.column} >= TO_DATE(:hoy, 'YYYY-MM-DD'))
        AND ${rules.montoDesde.column} <= :monto AND (${rules.montoHasta.column} IS NULL OR ${rules.montoHasta.column} >= :monto)
        AND (${rules.moneda.column} IS NULL OR ${rules.moneda.column} = :moneda)
        AND (${rules.idProveedor.column} IS NULL OR ${rules.idProveedor.column} = :idProveedor)
        AND (${rules.idDepartamento.column} IS NULL OR ${rules.idDepartamento.column} = :idDepartamento)
        AND (${rules.centroCosto.column} IS NULL OR ${rules.centroCosto.column} = :centroCosto)
        AND (${rules.proyecto.column} IS NULL OR ${rules.proyecto.column} = :proyecto)
        AND (NVL(${rules.requiereSinOc.column}, 'N') = 'N' OR :sinOc = 'S')
        AND (NVL(${rules.requiereDiferencia.column}, 'N') = 'N' OR :conDiferencia = 'S')
      GROUP BY ${rules.nivel.column}
      ORDER BY ${rules.nivel.column}`,
    binds, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const recorded = await connection.execute<ApprovalRow>(
    `SELECT ${approvals.nivel.column} AS NIVEL, ${approvals.estado.column} AS ESTADO, COUNT(*) AS TOTAL
       FROM ${CXP_TABLES.aprobaciones.table}
      WHERE ${approvals[target.approvalField].column} = :id
      GROUP BY ${approvals.nivel.column}, ${approvals.estado.column}`,
    { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const rows = recorded.rows ?? [];
  if (rows.some(row => row.ESTADO === 'PENDIENTE')) throw new CxpError('Aún hay aprobaciones pendientes para este registro', 409);
  for (const rule of required.rows ?? []) {
    const approved = rows.filter(row => row.NIVEL === rule.NIVEL && row.ESTADO === 'APROBADA').reduce((total, row) => total + row.TOTAL, 0);
    if (approved < rule.CANTIDAD_APROBADORES) {
      throw new CxpError(`Faltan aprobaciones de nivel ${rule.NIVEL} (${approved} de ${rule.CANTIDAD_APROBADORES}) según la regla "${rule.NOMBRE_REGLA}"`, 409);
    }
  }
}

/**
 * Al regresar un registro a un estado editable, las aprobaciones vigentes dejan de
 * valer: se aprobó otra versión del registro y debe iniciarse una nueva ronda.
 */
export async function resetApprovals(connection: Connection, resource: CxpResource, id: number, previousState: unknown, nextState: unknown): Promise<void> {
  const workflow = CXP_WORKFLOWS[resource];
  const target = approvalTarget[resource];
  if (!workflow || !target || previousState === nextState) return;
  if (workflow.editable.includes(String(previousState)) || !workflow.editable.includes(String(nextState))) return;
  const approvals = CXP_TABLES.aprobaciones.columns;
  await connection.execute(
    `UPDATE ${CXP_TABLES.aprobaciones.table} SET ${approvals.estado.column} = 'CANCELADA'
      WHERE ${approvals[target.approvalField].column} = :id AND ${approvals.estado.column} IN ('PENDIENTE', 'APROBADA')`,
    { id },
  );
}
