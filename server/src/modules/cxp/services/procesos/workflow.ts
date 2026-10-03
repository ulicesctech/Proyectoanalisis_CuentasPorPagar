import {
  accionProcesoSchema,
  cxpMoneySum,
  nuevaContrasenaSchema,
  type ActorProceso,
  type CxpRecord,
  type PermisoProceso,
  type ProcesoPago,
} from '@erp/contracts';
import { CxpError } from '../errors';
import type { ProcesoStore, ProcesoTx } from './ports';

const payable = ['APROBADA', 'CONTABILIZADA', 'PENDIENTE_PAGO', 'PARCIALMENTE_PAGADA', 'VENCIDA'];

function requireThat(test: unknown, message: string, status = 409): asserts test {
  if (!test) throw new CxpError(message, status);
}

function permit(actor: ActorProceso, permission: PermisoProceso) {
  requireThat(actor.permisos.includes(permission), 'Tu usuario no tiene permiso para esta acción', 403);
}

function totalOf(documents: CxpRecord[]) {
  return cxpMoneySum(...documents.map(document => Number(document.saldoPendiente)));
}

function eligible(documents: CxpRecord[]) {
  const first = documents[0];
  requireThat(first && Number(first.idProveedor) > 0, 'Selecciona documentos con proveedor');
  for (const document of documents) {
    requireThat(
      document.idProveedor === first.idProveedor &&
      document.idSucursal === first.idSucursal &&
      document.moneda === first.moneda,
      'Los documentos deben compartir proveedor, sucursal y moneda',
    );
    requireThat(
      document.naturaleza === 'D' &&
      payable.includes(String(document.estado)) &&
      document.posibleDuplicado !== 'S',
      'Solo se admiten obligaciones validadas/aprobadas, sin bloqueo ni duplicados',
    );
    requireThat(
      Number.isFinite(Number(document.saldoPendiente)) && Number(document.saldoPendiente) > 0,
      'El documento no tiene saldo disponible',
    );
  }
  return first;
}

export function matchesRule(
  rule: CxpRecord,
  process: ProcesoPago,
  documents: CxpRecord[],
  date: string,
): boolean {
  if (!['PAGO', 'LOTE'].includes(String(rule.tipoEntidad)) || rule.activa !== 'S') return false;
  if ((rule.vigenteDesde && String(rule.vigenteDesde) > date) || (rule.vigenteHasta && String(rule.vigenteHasta) < date)) return false;
  if ((rule.idProveedor && rule.idProveedor !== process.proveedor) || (rule.moneda && rule.moneda !== process.moneda)) return false;
  if (process.total < Number(rule.montoDesde) || (rule.montoHasta != null && process.total > Number(rule.montoHasta))) return false;

  return documents.some(document => {
    if (
      (rule.idDepartamento && rule.idDepartamento !== document.idDepartamento) ||
      (rule.centroCosto && rule.centroCosto !== document.centroCosto) ||
      (rule.proyecto && rule.proyecto !== document.proyecto)
    ) return false;
    const withoutPo = !document.noOrdenCompra;
    const withDifference =
      Number(document.diferenciaTotal) !== 0 ||
      Number(document.diferenciaPrecio) !== 0 ||
      Number(document.diferenciaCantidad) !== 0 ||
      Number(document.diferenciaImpuesto) !== 0;
    return (
      (rule.requiereSinOc == null || (rule.requiereSinOc === 'S') === withoutPo) &&
      (rule.requiereDiferencia == null || (rule.requiereDiferencia === 'S') === withDifference)
    );
  });
}

export function createPaymentWorkflow(store: ProcesoStore, clock = () => new Date()) {
  const stamp = () => clock().toISOString().replace('Z', '');
  const day = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(clock());


  const requireExecutionDate = (process: ProcesoPago) => {
    requireThat(
      Boolean(process.fechaProgramada),
      'El pago no tiene una fecha programada válida. Revisa la programación antes de ejecutarlo.',
      409,
    );
    requireThat(
      day() >= process.fechaProgramada!,
      `Este pago está programado para ${process.fechaProgramada}. Podrá ejecutarse a partir de esa fecha.`,
      409,
    );
  };

  const log = (process: ProcesoPago, actor: ActorProceso, action: string, detail: string) => {
    process.historial.push({
      fecha: stamp(),
      usuario: actor.id,
      nombre: actor.nombre,
      accion: action,
      detalle: detail,
    });
  };

  async function fresh(tx: ProcesoTx, process: ProcesoPago) {
    const documents: CxpRecord[] = [];
    for (const item of process.documentos) documents.push(await tx.row('documentos', item.id));
    eligible(documents);
    requireThat(
      documents[0].idProveedor === process.proveedor &&
      documents[0].idSucursal === process.sucursal &&
      documents[0].moneda === process.moneda,
      'Cambió el proveedor, sucursal o moneda de los documentos',
    );
    requireThat(
      totalOf(documents) === process.total &&
      documents.every((document, index) => Number(document.saldoPendiente) === process.documentos[index].importe),
      'Los saldos cambiaron; anula la solicitud y genera una nueva',
    );
    return documents;
  }

  async function validateAccounts(
    tx: ProcesoTx,
    process: ProcesoPago,
    originId: number,
    destinationId: number,
    paymentMethodId: number,
  ) {
    const origin = await tx.row('cuentas-bancarias', originId);
    const destination = await tx.row('cuentas-bancarias', destinationId);
    requireThat(
      origin.tipoTitular === 'EMPRESA' &&
      destination.tipoTitular === 'PROVEEDOR' &&
      destination.idProveedor === process.proveedor,
      'Las cuentas no corresponden a la empresa y al proveedor',
    );
    for (const account of [origin, destination]) {
      requireThat(
        account.estado === 'ACTIVA' &&
        account.estadoAprobacion === 'APROBADA' &&
        account.moneda === process.moneda,
        'Las cuentas deben estar activas, aprobadas y en la moneda del pago',
      );
    }
    return tx.paymentMethod(paymentMethodId);
  }

  async function validatePersistedAccounts(tx: ProcesoTx, process: ProcesoPago) {
    const payment = await tx.row('pagos', process.id);
    await validateAccounts(
      tx,
      process,
      Number(payment.idCuentaOrigen),
      Number(payment.idCuentaDestino),
      Number(payment.idFormaPago),
    );
    return payment;
  }

  async function touchPayment(tx: ProcesoTx, process: ProcesoPago, input: CxpRecord) {
    await tx.update('pagos', process.id, input);
    process.version = (await tx.get(process.id)).version;
  }

  return {
    list: store.list.bind(store),
    options: store.options.bind(store),

    async cheques(id: number, actor: ActorProceso) {
      permit(actor, 'TESORERIA');
      requireThat(Number.isSafeInteger(id) && id > 0, 'Identificador inválido', 400);
      return store.transaction(async tx => {
        await tx.actorExists(actor);
        const process = await tx.get(id);
        requireThat(process.estado === 'PROGRAMADA', 'El pago debe estar programado para seleccionar un cheque');
        requireExecutionDate(process);
        return tx.cheques(process);
      });
    },

    async create(raw: unknown, actor: ActorProceso) {
      permit(actor, 'CREAR');
      const input = nuevaContrasenaSchema.parse(raw);
      return store.transaction(async tx => {
        await tx.actorExists(actor);
        const existing = await tx.byKey(input.clave);
        if (existing) {
          requireThat(
            existing.creador === actor.id &&
            existing.documentos.map(document => document.id).join(',') === [...input.documentos].sort((a, b) => a - b).join(','),
            'La clave de reintento pertenece a otra solicitud',
          );
          return existing;
        }

        const documents: CxpRecord[] = [];
        for (const id of [...input.documentos].sort((a, b) => a - b)) documents.push(await tx.row('documentos', id));
        const first = eligible(documents);
        requireThat(input.idProveedor === first.idProveedor, 'Las facturas no pertenecen al proveedor seleccionado', 400);
        requireThat(input.fecha >= day(), 'La fecha prevista de pago no puede estar en el pasado', 400);
        await tx.openPeriod(Number(first.idSucursal), input.fecha);

        const method = await tx.paymentMethod(input.idFormaPago);

        const process: ProcesoPago = {
          id: 0,
          codigo: '',
          clave: input.clave,
          version: '',
          creador: actor.id,
          solicitante: actor.id,
          proveedor: Number(first.idProveedor),
          sucursal: Number(first.idSucursal),
          moneda: String(first.moneda),
          tipoCambio: Number(first.tipoCambio ?? 1),
          total: totalOf(documents),
          formaPago: method.id,
          formaPagoNombre: method.nombre,
          proveedorNombre: await tx.providerName(Number(first.idProveedor)),
          estado: 'EMITIDA',
          aprobaciones: [],
          historial: [],
          pago: 0,
          lote: undefined,
          fechaProgramada: input.fecha,
          aplicaciones: [],
          reimpresiones: 0,
          documentos: documents.map(document => ({
            id: Number(document.idDocumento),
            numero: String(document.numeroDocumento || document.noFacturaCompra || document.idDocumento),
            importe: Number(document.saldoPendiente),
          })),
        };

        await validateAccounts(tx, process, input.idCuentaOrigen, input.idCuentaDestino, input.idFormaPago);
        process.id = await tx.insert(process, input);
        process.pago = process.id;
        await tx.reserve(process);
        log(process, actor, 'CREAR', 'Constancia de documentos recibidos para pago. No acredita cancelación de la deuda.');
        await tx.save(process);
        return tx.get(process.id);
      });
    },

    async act(id: number, raw: unknown, actor: ActorProceso) {
      requireThat(Number.isSafeInteger(id) && id > 0, 'Identificador inválido', 400);
      const action = accionProcesoSchema.parse(raw);

      return store.transaction(async tx => {
        await tx.actorExists(actor);
        const process = await tx.get(id);
        requireThat(process.version === action.version, 'Otro usuario modificó este proceso. Actualiza antes de continuar');
        requireThat(process.estado !== 'ANULADA', 'Una solicitud anulada conserva su historial y no admite acciones');

        if (action.accion !== 'reimprimir') {
          for (const document of process.documentos) await tx.row('documentos', document.id);
          await tx.openPeriod(process.sucursal, day());
        }

        switch (action.accion) {
          case 'solicitar': {
            permit(actor, 'CREAR');
            requireThat(process.estado === 'EMITIDA', 'La solicitud ya fue enviada a revisión');
            const documents = await fresh(tx, process);
            const payment = await validatePersistedAccounts(tx, process);
            const rules = (await tx.rules())
              .filter(rule => matchesRule(rule, process, documents, day()))
              .sort((a, b) => Number(a.nivel) - Number(b.nivel) || Number(a.idRegla) - Number(b.idRegla));
            requireThat(rules.length > 0, 'Configura al menos una regla vigente de aprobación de PAGO o LOTE que cubra este importe');
            for (const rule of rules) {
              requireThat(
                Number.isInteger(rule.nivel) && Number(rule.nivel) > 0 &&
                Number.isInteger(rule.cantidadAprobadores) && Number(rule.cantidadAprobadores) > 0 &&
                Number(rule.cantidadAprobadores) <= 50 && Number(rule.idRolAprobador) > 0,
                'Una regla tiene nivel, rol o cantidad de aprobadores inválidos',
              );
            }

            process.lote = await tx.create('lotes-pago', {
              idSucursal: process.sucursal,
              idCuentaOrigen: Number(payment.idCuentaOrigen),
              codigoLote: `L-${process.codigo}`,
              tipoLote: 'PROVEEDORES',
              fechaEjecucion: process.fechaProgramada!,
              moneda: process.moneda,
              cantidadPagos: 1,
              montoTotal: process.total,
              estado: 'PENDIENTE_APROBACION',
              creadoPor: actor.id,
            });
            await touchPayment(tx, process, { idLote: process.lote, estado: 'PENDIENTE_APROBACION' });

            for (const rule of rules) {
              for (let slot = 0; slot < Number(rule.cantidadAprobadores); slot += 1) {
                const approval = await tx.create('aprobaciones', {
                  idRegla: rule.idRegla,
                  ...(rule.tipoEntidad === 'LOTE' ? { idLote: process.lote } : { idPago: process.id }),
                  nivel: rule.nivel,
                  idRolAprobador: rule.idRolAprobador,
                  estado: 'PENDIENTE',
                });
                process.aprobaciones.push({
                  id: approval,
                  regla: Number(rule.idRegla),
                  nombre: String(rule.nombreRegla),
                  nivel: Number(rule.nivel),
                  rol: Number(rule.idRolAprobador),
                  decision: 'PENDIENTE',
                });
              }
            }
            process.solicitante = actor.id;
            process.estado = 'EN_REVISION';
            log(process, actor, 'SOLICITAR', `Pago ${process.id}, lote ${process.lote}; reglas y niveles fijados al solicitar.`);
            break;
          }

          case 'aprobar':
          case 'rechazar': {
            permit(actor, 'APROBAR');
            // Modo demostración: no se aplica segregación por rol ni por usuario.
            // El mismo usuario puede crear, solicitar, aprobar y continuar el pago.
            requireThat(process.estado === 'EN_REVISION', 'El proceso no está en revisión');
            const approval = process.aprobaciones.find(item => item.id === action.idAprobacion);
            requireThat(approval && approval.decision === 'PENDIENTE', 'La aprobación ya fue resuelta o no corresponde');
            const pendingLevels = process.aprobaciones.filter(item => item.decision === 'PENDIENTE').map(item => item.nivel);
            requireThat(approval.nivel === Math.min(...pendingLevels), 'Completa primero los niveles anteriores');

            approval.usuario = actor.id;
            approval.decision = action.accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA';
            await tx.update('aprobaciones', approval.id, {
              estado: approval.decision,
              idUsuarioAprobador: actor.id,
              fechaDecision: stamp(),
              accion: action.accion.toUpperCase(),
              observacion: action.accion === 'rechazar' ? action.motivo : 'Aprobación por nivel',
            });

            if (action.accion === 'rechazar') {
              process.estado = 'RECHAZADA';
              for (const pending of process.aprobaciones.filter(item => item.decision === 'PENDIENTE')) {
                pending.decision = 'CANCELADA';
                await tx.update('aprobaciones', pending.id, {
                  estado: 'CANCELADA',
                  observacion: action.motivo,
                });
              }
              await touchPayment(tx, process, { estado: 'RECHAZADO', motivoRechazo: action.motivo });
              if (process.lote) await tx.update('lotes-pago', process.lote, { estado: 'RECHAZADO', motivoRechazo: action.motivo });
            } else if (process.aprobaciones.every(item => item.decision === 'APROBADA')) {
              process.estado = 'APROBADA';
              await touchPayment(tx, process, { estado: 'APROBADO' });
              if (process.lote) await tx.update('lotes-pago', process.lote, { estado: 'APROBADO' });
            }
            log(process, actor, action.accion.toUpperCase(), `Nivel ${approval.nivel}, regla ${approval.regla}. ${action.accion === 'rechazar' ? action.motivo : ''}`);
            break;
          }

          case 'programar': {
            permit(actor, 'TESORERIA');
            requireThat(
              process.estado === 'APROBADA' && process.aprobaciones.length > 0 && process.aprobaciones.every(item => item.decision === 'APROBADA'),
              'Faltan aprobaciones',
            );
            const scheduled = action.fecha ?? process.fechaProgramada!;
            requireThat(scheduled >= day(), 'Selecciona una fecha de pago de hoy o posterior');
            await tx.openPeriod(process.sucursal, scheduled);
            await fresh(tx, process);
            await validatePersistedAccounts(tx, process);
            process.fechaProgramada = scheduled;
            if (process.lote) await tx.update('lotes-pago', process.lote, { fechaEjecucion: scheduled });
            await touchPayment(tx, process, {
              estado: 'PROGRAMADO',
              fechaProgramada: scheduled,
              programadoPor: actor.id,
            });
            process.estado = 'PROGRAMADA';
            log(process, actor, 'PROGRAMAR', `Programado para ${scheduled}`);
            break;
          }

          case 'emitir': {
            permit(actor, 'TESORERIA');
            requireThat(process.estado === 'PROGRAMADA', 'El pago debe estar programado antes de generar el medio de pago');
            requireExecutionDate(process);
            await fresh(tx, process);
            const payment = await validatePersistedAccounts(tx, process);
            const issued = await tx.bankIssue(process, actor);
            process.cheque = issued.cheque;
            process.transferencia = issued.transferencia;

            if (process.cheque) {
              await touchPayment(tx, process, {
                numeroCheque: process.cheque.numero,
                numeroTransferencia: null,
                estado: 'ENVIADO',
              });
              log(process, actor, 'EMITIR', `Cheque ${process.cheque.numero} emitido desde Bancos para ${process.codigo}.`);
            } else if (process.transferencia) {
              await touchPayment(tx, process, {
                numeroCheque: null,
                numeroTransferencia: process.transferencia.id,
                estado: 'ENVIADO',
              });
              log(process, actor, 'EMITIR', `Transferencia ${process.transferencia.id} generada en Bancos para ${process.codigo}.`);
            } else {
              throw new CxpError('Bancos no devolvió un medio de pago válido', 500);
            }

            // Conservamos el mismo mapeo de estados de RF07/RF10.
            // ENVIADO representa un medio de pago ya generado, sea cheque o transferencia.
            process.estado = 'CHEQUE_EMITIDO';
            void payment;
            break;
          }

          case 'entregar': {
            permit(actor, 'TESORERIA');
            // Modo demostración: el mismo usuario puede programar y ejecutar.
            requireThat(
              process.estado === 'CHEQUE_EMITIDO' && (process.cheque || process.transferencia),
              'Primero genera el medio de pago en Bancos',
            );
            if (process.cheque) {
              requireThat(action.receptor && action.receptor.trim().length >= 3, 'Indica quién recibe el cheque', 400);
            }
            requireExecutionDate(process);
            await fresh(tx, process);
            await validatePersistedAccounts(tx, process);
            const advanced = await tx.bankAdvance(process, actor, 'EJECUTAR');
            process.cheque = advanced.cheque;
            process.transferencia = advanced.transferencia;
            await touchPayment(tx, process, {
              estado: 'EJECUTADO',
              fechaPago: stamp(),
              fechaEfectiva: day(),
              ejecutadoPor: actor.id,
            });
            process.aplicaciones = await tx.apply(process, actor, stamp());
            process.version = (await tx.get(process.id)).version;
            if (process.lote) {
              const batch = await tx.row('lotes-pago', process.lote);
              await tx.update('lotes-pago', process.lote, {
                estado: 'EJECUTADO',
                enviadoPor: batch.enviadoPor ?? actor.id,
                fechaEnvio: batch.fechaEnvio ?? stamp(),
              });
            }
            process.estado = 'ENTREGADO';
            process.receptor = process.cheque ? action.receptor : undefined;
            log(
              process,
              actor,
              'ENTREGAR',
              process.cheque
                ? `Cheque entregado a ${action.receptor}. Se aplicó ${process.moneda} ${process.total} a los documentos.`
                : `Transferencia ejecutada. Se aplicó ${process.moneda} ${process.total} a los documentos.`,
            );
            break;
          }

          case 'cobrar': {
            permit(actor, 'TESORERIA');
            // Modo demostración: el mismo usuario puede ejecutar y conciliar.
            requireThat(
              process.estado === 'ENTREGADO' && (process.cheque || process.transferencia),
              'El medio de pago debe estar ejecutado antes de finalizar',
            );
            const advanced = await tx.bankAdvance(process, actor, 'CONFIRMAR');
            process.cheque = advanced.cheque;
            process.transferencia = advanced.transferencia;
            await touchPayment(tx, process, { estado: 'CONCILIADO', conciliadoPor: actor.id });
            process.estado = 'COBRADO';
            log(
              process,
              actor,
              'COBRAR',
              process.cheque
                ? 'Confirmación de cobro del cheque; no se vuelve a aplicar el pago.'
                : 'Transferencia confirmada/conciliada; no se vuelve a aplicar el pago.',
            );
            break;
          }

          case 'reimprimir': {
            permit(actor, 'TESORERIA');
            requireThat(process.cheque && ['CHEQUE_EMITIDO', 'ENTREGADO', 'COBRADO'].includes(process.estado), 'No hay un cheque vigente para reimprimir');
            process.reimpresiones += 1;
            log(process, actor, 'REIMPRIMIR', action.motivo);
            break;
          }

          case 'anular': {
            permit(actor, 'ANULAR');
            requireThat(process.estado !== 'COBRADO', 'Un pago finalizado requiere devolución o ajuste; no admite anulación directa');
            if (process.cheque || process.transferencia) {
              const advanced = await tx.bankAdvance(process, actor, 'ANULAR');
              process.cheque = advanced.cheque;
              process.transferencia = advanced.transferencia;
            }
            if (process.aplicaciones.length) {
              await tx.reverse(process, actor, stamp(), action.motivo);
              process.version = (await tx.get(process.id)).version;
            }
            for (const approval of process.aprobaciones.filter(item => item.decision === 'PENDIENTE')) {
              approval.decision = 'CANCELADA';
              await tx.update('aprobaciones', approval.id, {
                estado: 'CANCELADA',
                observacion: action.motivo,
              });
            }
            await touchPayment(tx, process, { estado: 'ANULADO', motivoAnulacion: action.motivo });
            if (process.lote) await tx.update('lotes-pago', process.lote, { estado: 'ANULADO', motivoAnulacion: action.motivo });
            await tx.release(process);
            process.estado = 'ANULADA';
            log(process, actor, 'ANULAR', action.motivo);
            break;
          }
        }

        await tx.save(process);
        return tx.get(process.id);
      });
    },
  };
}
