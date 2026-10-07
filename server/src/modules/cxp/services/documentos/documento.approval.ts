import type { Connection } from 'oracledb';
import { createCxpRepository, withCxpTransaction } from '../../repositories/crud.repository';
import { getConnection } from '../../../../config/database';
import {
  documentoMatchesApprovalRule, findApprovalActor, insertDocumentoApprovalDecision,
  listActiveDocumentoApprovalRules, listDocumentoApprovalDecisions,
  type ApprovalActor, type DocumentoApprovalDecision, type DocumentoApprovalRule,
} from '../../repositories/documentos/documentoApproval.repository';
import { cxpMoneySum, type CxpRecord } from '@erp/contracts';
import { CxpError } from '../errors';

export type DocumentoApprovalContext = {
  estadoDocumento: string;
  nivelActual: number | null;
  reglas: Array<{
    idRegla: number;
    nombreRegla: string;
    nivel: number;
    idRolAprobador: number;
    cantidadAprobadores: number;
    aprobacionesRegistradas: number;
    faltantes: number;
    estado: 'COMPLETA' | 'DISPONIBLE' | 'ESPERA_NIVEL';
  }>;
  decisiones: DocumentoApprovalDecision[];
  actor: null | {
    idUsuario: number;
    nombre: string | null;
    idRol: number | null;
    puedeDecidir: boolean;
    reglasDisponibles: number[];
    impedimento: string | null;
  };
  impedimento: string | null;
};

type DecisionInput = {
  idRegla: number;
  idUsuarioAprobador: number;
  decision: 'APROBAR' | 'RECHAZAR';
  observacion: string | null;
};

function positiveId(value: unknown, field: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new CxpError(`${field} debe ser un entero positivo`);
  return id;
}

function parseDecisionInput(raw: unknown): DecisionInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CxpError('La decisión es inválida');
  const input = raw as Record<string, unknown>;
  const decision = input.decision;
  if (decision !== 'APROBAR' && decision !== 'RECHAZAR') throw new CxpError('La decisión debe ser APROBAR o RECHAZAR');
  const observacion = input.observacion == null ? null : String(input.observacion).trim();
  if (observacion && observacion.length > 1000) throw new CxpError('La observación no puede superar 1000 caracteres');
  if (decision === 'RECHAZAR' && !observacion) {
    throw new CxpError('Indica el motivo del rechazo', 400, [{ campo: 'observacion', mensaje: 'El motivo es obligatorio para rechazar' }]);
  }
  return {
    idRegla: positiveId(input.idRegla, 'La regla'),
    idUsuarioAprobador: positiveId(input.idUsuarioAprobador, 'El usuario aprobador'),
    decision,
    observacion,
  };
}

function approvedUsers(decisions: DocumentoApprovalDecision[], idRegla: number): Set<number> {
  return new Set(decisions.filter(item => item.idRegla === idRegla && item.estado === 'APROBADA' && item.idUsuarioAprobador != null)
    .map(item => Number(item.idUsuarioAprobador)));
}

function actorBlocker(documento: CxpRecord, actor: ApprovalActor | null): string | null {
  if (!actor) return 'El usuario indicado no existe.';
  if (!actor.usuarioActivo) return 'El usuario indicado está inactivo.';
  if (!actor.rolActivo) return 'El rol del usuario está inactivo.';
  if (actor.idUsuario === Number(documento.creadoPor) ||
      documento.solicitadoPor != null && actor.idUsuario === Number(documento.solicitadoPor)) {
    return 'Quien registró o solicitó el documento no puede aprobarlo.';
  }
  return null;
}

export function buildDocumentoApprovalContext(
  documento: CxpRecord,
  rules: DocumentoApprovalRule[],
  decisions: DocumentoApprovalDecision[],
  actor: ApprovalActor | null = null,
  actorRequested = false,
): DocumentoApprovalContext {
  const applicable = rules.filter(item => documentoMatchesApprovalRule(documento, item));
  const counts = new Map(applicable.map(item => [item.idRegla, approvedUsers(decisions, item.idRegla).size]));
  const incomplete = applicable.filter(item => (counts.get(item.idRegla) ?? 0) < item.cantidadAprobadores);
  const nivelActual = incomplete.length ? Math.min(...incomplete.map(item => item.nivel)) : null;
  const estadoDocumento = String(documento.estado);
  let impedimento: string | null = null;
  if (estadoDocumento === 'PENDIENTE_APROBACION' && !applicable.length) {
    impedimento = 'No existe una regla de aprobación activa y vigente que aplique a este documento.';
  } else if (estadoDocumento !== 'PENDIENTE_APROBACION') {
    impedimento = estadoDocumento === 'APROBADA' ? 'El documento ya completó su aprobación.'
      : estadoDocumento === 'RECHAZADA' ? 'El documento fue rechazado y no admite más decisiones.'
        : 'El documento no está pendiente de aprobación.';
  }
  const blocker = actorRequested ? actorBlocker(documento, actor) : null;
  const available = !impedimento && !blocker && actor ? incomplete.filter(item =>
    item.nivel === nivelActual && item.idRolAprobador === actor.idRol && !approvedUsers(decisions, item.idRegla).has(actor.idUsuario)
  ) : [];
  let actorImpediment = blocker;
  if (actorRequested && !actorImpediment && !impedimento && actor && !available.length) {
    const actorRules = incomplete.filter(item => item.nivel === nivelActual && item.idRolAprobador === actor.idRol);
    actorImpediment = actorRules.length
      ? 'Este usuario ya registró su decisión para las reglas disponibles.'
      : 'El rol del usuario no corresponde al nivel de aprobación actual.';
  }
  return {
    estadoDocumento,
    nivelActual,
    reglas: applicable.map(item => {
      const approvals = counts.get(item.idRegla) ?? 0;
      return {
        idRegla: item.idRegla, nombreRegla: item.nombreRegla, nivel: item.nivel,
        idRolAprobador: item.idRolAprobador, cantidadAprobadores: item.cantidadAprobadores,
        aprobacionesRegistradas: approvals, faltantes: Math.max(0, item.cantidadAprobadores - approvals),
        estado: approvals >= item.cantidadAprobadores ? 'COMPLETA'
          : item.nivel === nivelActual ? 'DISPONIBLE' : 'ESPERA_NIVEL',
      };
    }),
    decisiones: decisions,
    actor: actorRequested ? {
      idUsuario: actor?.idUsuario ?? 0, nombre: actor?.nombre ?? null, idRol: actor?.idRol ?? null,
      puedeDecidir: available.length > 0, reglasDisponibles: available.map(item => item.idRegla),
      impedimento: actorImpediment ?? impedimento,
    } : null,
    impedimento,
  };
}

async function loadApprovalContext(connection: Connection, idDocumento: number, actorId?: number, lock = false) {
  const documento = await createCxpRepository('documentos').bind(connection).findById(idDocumento, lock);
  if (!documento) throw new CxpError('Documento no encontrado', 404);
  const rules = await listActiveDocumentoApprovalRules(connection);
  const decisions = await listDocumentoApprovalDecisions(connection, idDocumento);
  const actor = actorId ? await findApprovalActor(connection, actorId) : null;
  return { documento, rules, decisions, actor,
    context: buildDocumentoApprovalContext(documento, rules, decisions, actor, actorId !== undefined) };
}

export async function applyCajaChicaFundOnApproval(connection: Connection, documento: CxpRecord): Promise<void> {
  if (!documento.idCompromiso || documento.tipoDocumento !== 'GASTO_CAJA_CHICA') return;
  const fundRepo = createCxpRepository('compromisos').bind(connection);
  const fund = await fundRepo.findById(Number(documento.idCompromiso), true);
  if (!fund || fund.tipoCompromiso !== 'FONDO_CAJA_CHICA' || fund.estado !== 'ACTIVO') {
    throw new CxpError('El fondo de caja chica debe estar activo', 409);
  }
  if (fund.moneda !== documento.moneda) throw new CxpError('La moneda del gasto o reposición debe coincidir con el fondo', 409);
  const amount = Number(documento.totalNeto);
  if (!Number.isFinite(amount) || amount <= 0) throw new CxpError('El importe de caja chica debe ser positivo', 409);
  const balance = cxpMoneySum(Number(fund.saldoCapital), -amount);
  if (balance < 0) throw new CxpError('El gasto supera el saldo disponible del fondo', 409);
  await fundRepo.update(Number(fund.idCompromiso), { saldoCapital: balance });
}

export async function readDocumentoApprovalContext(idDocumento: number, actorId?: number): Promise<DocumentoApprovalContext> {
  positiveId(idDocumento, 'El documento');
  if (actorId !== undefined) positiveId(actorId, 'El usuario aprobador');
  const connection = await getConnection();
  try { return (await loadApprovalContext(connection, idDocumento, actorId)).context; }
  finally { await connection.close(); }
}

export function createDocumentoApprovalOperation(run: typeof withCxpTransaction = withCxpTransaction) {
  return async (idDocumento: number, raw: unknown): Promise<DocumentoApprovalContext> => {
    positiveId(idDocumento, 'El documento');
    const input = parseDecisionInput(raw);
    return run(async connection => {
      const loaded = await loadApprovalContext(connection, idDocumento, input.idUsuarioAprobador, true);
      if (loaded.documento.estado !== 'PENDIENTE_APROBACION') {
        throw new CxpError(loaded.context.impedimento ?? 'El documento no admite decisiones de aprobación', 409);
      }
      if (loaded.context.impedimento) throw new CxpError(loaded.context.impedimento, 409);
      if (loaded.decisions.some(item => item.idRegla === input.idRegla &&
          item.idUsuarioAprobador === input.idUsuarioAprobador && ['APROBADA', 'RECHAZADA'].includes(item.estado))) {
        throw new CxpError('Este usuario ya registró una decisión para la regla indicada', 409);
      }
      if (!loaded.context.actor?.reglasDisponibles.includes(input.idRegla)) {
        throw new CxpError(loaded.context.actor?.impedimento ?? 'El usuario no puede decidir esta regla', 403);
      }
      const approvalRule = loaded.rules.find(item => item.idRegla === input.idRegla)!;
      await insertDocumentoApprovalDecision(connection, {
        idDocumento, idRegla: approvalRule.idRegla, nivel: approvalRule.nivel,
        idRolAprobador: approvalRule.idRolAprobador, idUsuarioAprobador: input.idUsuarioAprobador,
        estado: input.decision === 'APROBAR' ? 'APROBADA' : 'RECHAZADA',
        accion: input.decision, observacion: input.observacion,
      });
      if (input.decision === 'RECHAZAR') {
        await createCxpRepository('documentos').bind(connection).update(idDocumento, {
          estado: 'RECHAZADA', motivoRechazo: input.observacion, modificadoPor: input.idUsuarioAprobador,
        });
      } else {
        const updatedDecisions = await listDocumentoApprovalDecisions(connection, idDocumento);
        const after = buildDocumentoApprovalContext(loaded.documento, loaded.rules, updatedDecisions, loaded.actor, true);
        if (after.reglas.length > 0 && after.reglas.every(item => item.estado === 'COMPLETA')) {
          await applyCajaChicaFundOnApproval(connection, loaded.documento);
          await createCxpRepository('documentos').bind(connection).update(idDocumento, {
            estado: 'APROBADA', modificadoPor: input.idUsuarioAprobador,
          });
        }
      }
      return (await loadApprovalContext(connection, idDocumento, input.idUsuarioAprobador)).context;
    });
  };
}

export const decideDocumentoApproval = createDocumentoApprovalOperation();
