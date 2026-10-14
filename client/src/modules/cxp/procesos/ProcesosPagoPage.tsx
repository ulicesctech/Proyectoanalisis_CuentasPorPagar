import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import {
  accionProcesoSchema,
  nuevaContrasenaSchema,
  estadosBandeja,
  cxpMoneySum,
} from '@erp/contracts';

import type {
  BandejaProceso,
  AccionProceso,
  ActorProceso,
  ListaProcesos,
  OpcionesProceso,
  ProcesoPago,
} from '@erp/contracts';

import { useNavigate } from 'react-router-dom';

import { RelationSelect } from '../components/RelationSelect';
import { Button, TextInput, Select } from '../../../shared/ui-kit';
import { apiRequest, ApiError } from '../../../shared/api';
import { CxpLayout } from '../CxpLayout';

import './procesos.css';

const titles: Record<ProcesoPago['estado'], string> = {
  EMITIDA: 'Contraseña emitida',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  PROGRAMADA: 'Programada',
  CHEQUE_EMITIDO: 'Medio de pago generado',
  ENTREGADO: 'Pago ejecutado',
  COBRADO: 'Finalizado',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
};

const money = (n: number, c = 'GTQ') =>
  new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: c,
  }).format(n);


const formatDateGt = (value?: string) => {
  if (!value || value.length < 10) return '—';
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
};

const daysBetweenIso = (from: string, to: string) => {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
};

const flowGuide = [
  {
    label: 'Factura',
    hint: 'Documento recibido',
    route: '/cxp/contrasenas',
  },
  {
    label: 'Constancia',
    hint: 'Recepción registrada',
    route: '/cxp/contrasenas',
  },
  {
    label: 'Solicitud',
    hint: 'Preparar pago',
    route: '/cxp/contrasenas',
  },
  {
    label: 'Autorización',
    hint: 'Aprobar o rechazar',
    route: '/cxp/autorizaciones',
  },
  {
    label: 'Programación',
    hint: 'Programar pago',
    route: '/cxp/pagos',
  },
  {
    label: 'Ejecución',
    hint: 'Cheque / transferencia',
    route: '/cxp/cheques',
  },
  {
    label: 'Aplicación',
    hint: 'Aplicar a factura',
    route: '/cxp/cheques',
  },
  {
    label: 'Finalizado',
    hint: 'Pago conciliado',
    route: '/cxp/cheques',
  },
] as const;

type UsuarioOperativo = ActorProceso & {
  rolNombre: string;
};

function etapaActual(
  proceso: ProcesoPago | null,
  bandeja: BandejaProceso,
): number {
  if (proceso) {
    switch (proceso.estado) {
      case 'EMITIDA':
        return 2;

      case 'EN_REVISION':
      case 'RECHAZADA':
        return 3;

      case 'APROBADA':
        return 4;

      case 'PROGRAMADA':
        return 5;

      case 'CHEQUE_EMITIDO':
        return 6;

      case 'ENTREGADO':
      case 'COBRADO':
        return 7;

      case 'ANULADA':
        return 2;
    }
  }

  switch (bandeja) {
    case 'contrasenas':
      return 0;

    case 'autorizaciones':
      return 3;

    case 'pagos':
      return 4;

    case 'cheques':
      return 5;
  }
}

function siguienteRuta(proceso: ProcesoPago): {
  route: string;
  label: string;
} | null {
  switch (proceso.estado) {
    case 'EN_REVISION':
      return {
        route: '/cxp/autorizaciones',
        label: 'Ir a Autorizaciones',
      };

    case 'APROBADA':
      return {
        route: '/cxp/pagos',
        label: 'Ir a Programación',
      };

    case 'PROGRAMADA':
      return {
        route: '/cxp/cheques',
        label: 'Ir a Ejecución de pago',
      };

    default:
      return null;
  }
}

type VistaResumen = 'activos' | 'historial';

const estadosHistorial = new Set<ProcesoPago['estado']>([
  'COBRADO',
  'RECHAZADA',
  'ANULADA',
]);

function rutaParaProceso(proceso: ProcesoPago): string {
  switch (proceso.estado) {
    case 'EMITIDA':
      return '/cxp/contrasenas';
    case 'EN_REVISION':
      return '/cxp/autorizaciones';
    case 'APROBADA':
      return '/cxp/pagos';
    case 'PROGRAMADA':
    case 'CHEQUE_EMITIDO':
    case 'ENTREGADO':
    case 'COBRADO':
      return '/cxp/cheques';
    case 'RECHAZADA':
    case 'ANULADA':
    default:
      return '/cxp/contrasenas';
  }
}

function rutaBandeja(bandeja: BandejaProceso): string {
  switch (bandeja) {
    case 'contrasenas':
      return '/cxp/contrasenas';
    case 'autorizaciones':
      return '/cxp/autorizaciones';
    case 'pagos':
      return '/cxp/pagos';
    case 'cheques':
      return '/cxp/cheques';
  }
}

function nombreEtapa(proceso: ProcesoPago): string {
  switch (proceso.estado) {
    case 'EMITIDA':
      return 'Solicitud';
    case 'EN_REVISION':
      return 'Autorización';
    case 'APROBADA':
      return 'Programación';
    case 'PROGRAMADA':
      return 'Ejecución de pago';
    case 'CHEQUE_EMITIDO':
    case 'ENTREGADO':
      return 'Aplicación';
    case 'COBRADO':
      return 'Finalizado';
    case 'RECHAZADA':
      return 'Rechazada';
    case 'ANULADA':
      return 'Anulada';
  }
}

function indiceEtapaProceso(proceso: ProcesoPago): number {
  return etapaActual(proceso, 'contrasenas');
}


export function ProcesosPagoPage({
  bandeja = 'contrasenas',
}: {
  bandeja?: BandejaProceso;
}) {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<UsuarioOperativo[]>([]);
  const [actor, setActor] = useState<UsuarioOperativo | null>(null);

  const [actorId, setActorId] = useState(
    () => localStorage.getItem('cxp.actorId') ?? '',
  );

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyModal, setBusyModal] = useState(false);
  const [busyMessage, setBusyMessage] = useState('Procesando operación…');
  const [modalError, setModalError] = useState('');

  const [list, setList] = useState<ListaProcesos>({
    data: [],
    page: 1,
    hasMore: false,
  });

  const [options, setOptions] = useState<OpcionesProceso | null>(null);
  const [selected, setSelected] = useState<ProcesoPago | null>(null);

  const [chosen, setChosen] = useState<number[]>([]);

  const key = useRef(crypto.randomUUID());

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');

  const [status, setStatus] = useState(
    bandeja === 'autorizaciones' ? 'EN_REVISION' : '',
  );

  const [success, setSuccess] = useState('');
  const [reason, setReason] = useState('');
  const [receiver, setReceiver] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [vistaResumen, setVistaResumen] = useState<VistaResumen>('activos');
  const [overview, setOverview] = useState<ProcesoPago[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [processSearch, setProcessSearch] = useState('');
  const [dashboardStage, setDashboardStage] = useState('all');
  const [dashboardStatus, setDashboardStatus] = useState('');

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const headers = actorId
    ? {
        'X-CXP-Actor-Id': actorId,
      }
    : {};

  const call = <T,>(
    path: string,
    method = 'GET',
    body?: unknown,
  ) =>
    apiRequest<T>(`/cxp/procesos${path}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    });

  async function refresh(page = list.page) {
    const [rows, opts] = await Promise.all([
      call<ListaProcesos>(
        `?page=${page}&bandeja=${bandeja}&estado=${status}`,
      ),

      call<OpcionesProceso>(
        `/opciones?search=${encodeURIComponent(search)}${
          provider
            ? `&proveedor=${provider}`
            : ''
        }`,
      ),
    ]);

    setList(rows);
    setOptions(opts);

    setSelected(current =>
      current
        ? rows.data.find(
            process => process.id === current.id,
          ) ?? current
        : null,
    );
  }

  async function run(
    fn: () => Promise<void>,
    config: {
      overlay?: boolean;
      message?: string;
    } = {},
  ) {
    if (busy) return;

    const showOverlay = config.overlay ?? false;

    setBusy(true);
    setBusyModal(showOverlay);
    setBusyMessage(config.message ?? 'Procesando operación…');
    setError('');
    setSuccess('');
    setModalError('');

    try {
      await fn();
    } catch (e) {
      const issues = (
        e as {
          issues?: Array<{
            path: unknown[];
            message: string;
          }>;
        }
      ).issues;

      const errorMessage = issues
        ? issues
            .map(
              issue =>
                `${issue.path.join('.')}: ${issue.message}`,
            )
            .join(' · ')
        : e instanceof Error
          ? e.message
          : 'No se pudo completar la operación';

      setError(errorMessage);

      if (showOverlay) {
        setModalError(errorMessage);
      }

      if (
        e instanceof ApiError &&
        e.status === 401
      ) {
        localStorage.removeItem('cxp.actorId');

        setActorId('');
        setActor(null);
        setSelected(null);

        setList({
          data: [],
          page: 1,
          hasMore: false,
        });
      }
    } finally {
      setBusy(false);
      setBusyModal(false);
    }
  }


  async function refreshOverview() {
    if (!actorId) {
      setOverview([]);
      return;
    }

    setOverviewLoading(true);

    try {
      const lanes: BandejaProceso[] = [
        'contrasenas',
        'autorizaciones',
        'pagos',
        'cheques',
      ];

      const groups = await Promise.all(
        lanes.map(async lane => {
          const result: ProcesoPago[] = [];
          let page = 1;

          while (page <= 25) {
            const rows = await call<ListaProcesos>(
              `?page=${page}&bandeja=${lane}&estado=`,
            );

            result.push(...rows.data);

            if (!rows.hasMore) break;
            page += 1;
          }

          return result;
        }),
      );

      const unique = new Map<number, ProcesoPago>();

      groups.flat().forEach(process => {
        unique.set(process.id, process);
      });

      setOverview(
        [...unique.values()].sort((a, b) => b.id - a.id),
      );
    } finally {
      setOverviewLoading(false);
    }
  }

  function prepararDetalle(process: ProcesoPago) {
    setSelected(process);
    setReason('');
    setReceiver('');
    setDate(process.fechaProgramada ?? today);
    setOrigin('');
    setDestination('');
    setSuccess('');
    setModalError('');
  }

  function gestionarProceso(process: ProcesoPago) {
    const destinationRoute = rutaParaProceso(process);
    const currentRoute = rutaBandeja(bandeja);

    if (
      !estadosHistorial.has(process.estado) &&
      destinationRoute !== currentRoute
    ) {
      sessionStorage.setItem(
        'cxp.openProcessId',
        String(process.id),
      );
      navigate(destinationRoute);
      return;
    }

    prepararDetalle(process);
  }

  async function cargarUsuarios() {
    const rows =
      await apiRequest<UsuarioOperativo[]>(
        '/cxp/procesos/usuarios-operativos',
      );

    setUsuarios(rows);

    if (!rows.length) {
      setActor(null);
      return;
    }

    const guardado = rows.find(
      usuario =>
        String(usuario.id) === actorId,
    );

    setActor(guardado ?? null);
  }

  function cambiarActor(id: string) {
    setActorId(id);

    setSelected(null);
    setChosen([]);
    setReason('');
    setReceiver('');
    setPaymentMethod('');
    setOverview([]);

    setList({
      data: [],
      page: 1,
      hasMore: false,
    });

    if (!id) {
      localStorage.removeItem('cxp.actorId');
      setActor(null);
      return;
    }

    localStorage.setItem(
      'cxp.actorId',
      id,
    );

    const usuario =
      usuarios.find(
        item =>
          String(item.id) === id,
      ) ?? null;

    setActor(usuario);
  }

  useEffect(() => {
    void run(cargarUsuarios, {
      message: 'Cargando usuarios operativos…',
    });

    // Solo cargar usuarios al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (actorId) {
      void run(async () => {
        await refresh(1);
        await refreshOverview();
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actorId,
    status,
    provider,
    bandeja,
  ]);

  useEffect(() => {
    setStatus(
      bandeja === 'autorizaciones'
        ? 'EN_REVISION'
        : '',
    );

    setSelected(null);
  }, [bandeja]);


  useEffect(() => {
    const pendingId = Number(
      sessionStorage.getItem('cxp.openProcessId') ?? 0,
    );

    if (!actorId || !pendingId) return;

    let active = true;

    void run(async () => {
      const process = await call<ProcesoPago>(`/${pendingId}`);
      if (!active) return;

      const destinationRoute = rutaParaProceso(process);
      const currentRoute = rutaBandeja(bandeja);

      if (destinationRoute !== currentRoute) {
        navigate(destinationRoute);
        return;
      }

      prepararDetalle(process);
      sessionStorage.removeItem('cxp.openProcessId');
    }, {
      overlay: true,
      message: 'Abriendo el pago seleccionado…',
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, bandeja]);

  async function create() {
    await run(async () => {
      const process =
        await call<ProcesoPago>(
          '',
          'POST',
          nuevaContrasenaSchema.parse({
            idProveedor:
              Number(provider),

            documentos:
              chosen,

            idCuentaOrigen:
              Number(origin),

            idCuentaDestino:
              Number(destination),

            idFormaPago:
              Number(paymentMethod),

            fecha:
              date,

            clave:
              key.current,
          }),
        );

      setSelected(process);

      setChosen([]);
      setPaymentMethod('');

      key.current =
        crypto.randomUUID();

      await refresh(1);
      await refreshOverview();
      setCreateOpen(false);

      setSuccess(
        'Contraseña creada. Ya podés enviarla a autorización.',
      );
    }, {
      overlay: true,
      message: 'Creando contraseña y reservando documentos…',
    });
  }

  function loadingMessageForAction(
    action: AccionProceso['accion'],
  ): string {
    switch (action) {
      case 'solicitar':
        return 'Validando reglas y enviando la solicitud a autorización…';
      case 'aprobar':
        return 'Registrando la aprobación…';
      case 'rechazar':
        return 'Registrando el rechazo…';
      case 'programar':
        return 'Programando el pago…';
      case 'emitir':
        return 'Generando el medio de pago en Bancos…';
      case 'entregar':
        return 'Ejecutando el pago y aplicándolo a las facturas…';
      case 'cobrar':
        return 'Confirmando y finalizando el pago…';
      case 'reimprimir':
        return 'Registrando la reimpresión…';
      case 'anular':
        return 'Anulando el proceso y validando sus aplicaciones…';
      default:
        return 'Procesando operación…';
    }
  }

  function successMessageForAction(
    action: AccionProceso['accion'],
  ): string {
    switch (action) {
      case 'solicitar':
        return 'Solicitud enviada a autorización. Ya podés continuar desde la bandeja Autorizaciones.';
      case 'aprobar':
        return 'Aprobación registrada correctamente.';
      case 'rechazar':
        return 'Rechazo registrado correctamente.';
      case 'programar':
        return 'Pago programado correctamente.';
      case 'emitir':
        return 'Medio de pago generado correctamente en Bancos.';
      case 'entregar':
        return 'Pago ejecutado y aplicado correctamente.';
      case 'cobrar':
        return 'Pago finalizado correctamente.';
      case 'reimprimir':
        return 'Reimpresión registrada correctamente.';
      case 'anular':
        return 'Proceso anulado correctamente.';
      default:
        return 'Operación registrada correctamente.';
    }
  }

  async function act(
    action: AccionProceso,
    print = false,
  ) {
    if (!selected) return;

    await run(async () => {
      const updated =
        await call<ProcesoPago>(
          `/${selected.id}/acciones`,
          'POST',
          accionProcesoSchema.parse(
            action,
          ),
        );

      setSelected(updated);

      setReason('');

      await refresh();
      await refreshOverview();

      setSuccess(
        successMessageForAction(action.accion),
      );

      if (print) {
        requestAnimationFrame(
          () => window.print(),
        );
      }
    }, {
      overlay: true,
      message: loadingMessageForAction(action.accion),
    });
  }

  const can = (
    permission:
      ActorProceso['permisos'][number],
  ) =>
    actor?.permisos.includes(
      permission,
    ) ?? false;

  const input = (
    label: string,
    value: string,
    onChange: (
      value: string,
    ) => void,
    extra: Record<
      string,
      unknown
    > = {},
  ) => (
    <TextInput
      label={label}
      value={value}
      onChange={(
        event: ChangeEvent<HTMLInputElement>,
      ) =>
        onChange(
          event.target.value,
        )
      }
      {...extra}
    />
  );

  const bandejaStep = etapaActual(null, bandeja);

  const nextStage =
    selected
      ? siguienteRuta(selected)
      : null;

  const selectedForm = options?.formasPago.find(
    option => String(option.id) === paymentMethod,
  );
  const selectedIsCheque = selectedForm?.tipo === 'CHEQUE';
  const processIsCheque = Boolean(selected?.cheque) || /CHEQUE/i.test(selected?.formaPagoNombre ?? '');
  const processIsTransfer = Boolean(selected?.transferencia) || /TRANSFERENCIA/i.test(selected?.formaPagoNombre ?? '');

  const scheduledDate = selected?.fechaProgramada ?? '';
  const daysToScheduled = scheduledDate ? daysBetweenIso(today, scheduledDate) : 0;
  const executionTooEarly = Boolean(scheduledDate) && daysToScheduled > 0;
  const executionOverdue = Boolean(scheduledDate) && daysToScheduled < 0;

  const activeOverview = overview.filter(
    process => !estadosHistorial.has(process.estado),
  );

  const historyOverview = overview.filter(
    process => estadosHistorial.has(process.estado),
  );

  const baseOverview =
    vistaResumen === 'activos'
      ? activeOverview
      : historyOverview;

  const normalizedProcessSearch = processSearch.trim().toLowerCase();

  const visibleOverview = baseOverview.filter(process => {
    const matchesSearch =
      !normalizedProcessSearch ||
      process.codigo.toLowerCase().includes(normalizedProcessSearch) ||
      (process.proveedorNombre ?? '')
        .toLowerCase()
        .includes(normalizedProcessSearch) ||
      String(process.proveedor).includes(normalizedProcessSearch) ||
      process.documentos.some(documento =>
        documento.numero
          .toLowerCase()
          .includes(normalizedProcessSearch),
      );

    const matchesStage =
      dashboardStage === 'all' ||
      String(indiceEtapaProceso(process)) === dashboardStage;

    const matchesStatus =
      !dashboardStatus || process.estado === dashboardStatus;

    return matchesSearch && matchesStage && matchesStatus;
  });

  const uniqueDocumentCount = new Set(
    overview.flatMap(process =>
      process.documentos.map(documento => documento.id),
    ),
  ).size;

  const flowCounts = [
    uniqueDocumentCount,
    overview.length,
    overview.filter(process => process.estado === 'EMITIDA').length,
    overview.filter(process => process.estado === 'EN_REVISION').length,
    overview.filter(process => process.estado === 'APROBADA').length,
    overview.filter(process => process.estado === 'PROGRAMADA').length,
    overview.filter(process =>
      ['CHEQUE_EMITIDO', 'ENTREGADO'].includes(process.estado),
    ).length,
    overview.filter(process => process.estado === 'COBRADO').length,
  ];

  return (
    <CxpLayout
      resource="pagos"
      bandeja={bandeja}
    >
      <div className="space-y-5">

        {/* MODAL DE PROCESAMIENTO */}

        {busyModal && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
              <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

              <h2 className="text-base font-semibold text-slate-900">
                Procesando
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                {busyMessage}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Esperá un momento. No cierres esta ventana.
              </p>
            </div>
          </div>
        )}

        {/* MODAL DE ERROR DE OPERACIÓN */}

        {modalError && !busy && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-[1px]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cxp-operation-error-title"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-red-50 text-xl font-bold text-red-600">
                !
              </div>

              <h2
                id="cxp-operation-error-title"
                className="mt-4 text-center text-base font-semibold text-slate-900"
              >
                No se pudo completar la operación
              </h2>

              <p className="mt-2 text-center text-sm text-slate-600">
                {modalError}
              </p>

              {modalError
                .toLowerCase()
                .includes('regla vigente de aprobación') && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  La contraseña no avanzó de etapa. El proceso conserva su estado actual y sus facturas continúan pendientes de pago.
                </div>
              )}

              {selected && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  Proceso: <strong>{selected.codigo}</strong>
                  {' · '}
                  Estado: <strong>{titles[selected.estado]}</strong>
                </div>
              )}

              <div className="mt-5 flex justify-center">
                <Button
                  onClick={() => setModalError('')}
                >
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL NUEVA CONTRASEÑA */}

        {createOpen && actor && bandeja === 'contrasenas' && (
          <div
            className="fixed inset-0 z-[9997] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
            aria-label="Nueva contraseña de pago"
            onMouseDown={event => {
              if (event.target === event.currentTarget && !busy) {
                setCreateOpen(false);
              }
            }}
          >
            <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Nueva contraseña de pago
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Seleccioná las facturas y cuentas relacionadas. La constancia reserva los documentos; todavía no disminuye su saldo.
                  </p>
                </div>

                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setCreateOpen(false)}
                >
                  Cerrar
                </Button>
              </div>

              <div className="space-y-5">
                <RelationSelect
                  catalog="proveedores"
                  label="Proveedor"
                  required
                  readOnly={busy}
                  value={provider}
                  onChange={value => {
                    setProvider(value);
                    setChosen([]);
                    setOrigin('');
                    setDestination('');
                    setPaymentMethod('');
                    setOptions(null);
                  }}
                />

                <div className="flex flex-wrap items-end gap-3">
                  {input(
                    'Buscar factura del proveedor',
                    search,
                    setSearch,
                    {
                      maxLength: 80,
                      placeholder: 'Ej. F-001',
                    },
                  )}

                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => run(() => refresh())}
                  >
                    Buscar
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Facturas disponibles
                    </p>
                    <p className="text-xs text-slate-500">
                      Solo se permiten documentos compatibles del mismo proveedor, sucursal y moneda.
                    </p>
                  </div>

                  <div className="max-h-60 divide-y overflow-auto px-4">
                    {options?.documentos.map(documento => (
                      <label
                        key={documento.id}
                        className="flex cursor-pointer items-center gap-3 py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={chosen.includes(documento.id)}
                          disabled={
                            busy ||
                            (!chosen.includes(documento.id) &&
                              chosen.length > 0 &&
                              options.documentos.some(
                                current =>
                                  chosen.includes(current.id) &&
                                  (current.moneda !== documento.moneda ||
                                    current.sucursal !== documento.sucursal),
                              ))
                          }
                          onChange={event =>
                            setChosen(current =>
                              event.target.checked
                                ? [...current, documento.id]
                                : current.filter(id => id !== documento.id),
                            )
                          }
                        />

                        <span className="flex-1">
                          <strong>{documento.nombre}</strong>
                          {' · '}
                          {money(documento.saldo, documento.moneda)}
                        </span>
                      </label>
                    ))}

                    {options?.documentos.length === 0 && (
                      <p className="py-4 text-sm text-slate-500">
                        {provider
                          ? 'No hay facturas aprobadas con saldo disponible para este proveedor.'
                          : 'Seleccioná un proveedor para consultar sus facturas.'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Total seleccionado</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {money(
                      cxpMoneySum(
                        ...(options?.documentos
                          .filter(documento => chosen.includes(documento.id))
                          .map(documento => documento.saldo) ?? []),
                      ),
                      options?.documentos.find(documento =>
                        chosen.includes(documento.id),
                      )?.moneda,
                    )}
                  </p>
                </div>

                <Select
                  label="Medio de pago"
                  required
                  value={paymentMethod}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setPaymentMethod(event.target.value);
                    setOrigin('');
                    setDestination('');
                  }}
                  options={[
                    { value: '', label: 'Seleccionar medio de pago…' },
                    ...(options?.formasPago ?? []).map(option => ({
                      value: String(option.id),
                      label: option.nombre,
                    })),
                  ]}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    label="Cuenta de la empresa"
                    required
                    value={origin}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setOrigin(event.target.value)
                    }
                    options={[
                      { value: '', label: 'Seleccionar…' },
                      ...(options?.origenes ?? [])
                        .filter(
                          option =>
                            !chosen.length ||
                            option.moneda ===
                              options?.documentos.find(documento =>
                                chosen.includes(documento.id),
                              )?.moneda,
                        )
                        .map(option => ({
                          value: String(option.id),
                          label: option.nombre,
                        })),
                    ]}
                  />

                  <Select
                    label={selectedIsCheque ? 'Cuenta del proveedor (referencia)' : 'Cuenta destino del proveedor'}
                    required
                    value={destination}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setDestination(event.target.value)
                    }
                    options={[
                      { value: '', label: 'Seleccionar…' },
                      ...(options?.destinos ?? [])
                        .filter(
                          option =>
                            option.proveedor === Number(provider) &&
                            (!chosen.length ||
                              option.moneda ===
                                options?.documentos.find(documento =>
                                  chosen.includes(documento.id),
                                )?.moneda),
                        )
                        .map(option => ({
                          value: String(option.id),
                          label: option.nombre,
                        })),
                    ]}
                  />
                </div>

                {input(
                  'Fecha prevista de pago',
                  date,
                  setDate,
                  {
                    type: 'date',
                    required: true,
                    min: today,
                  },
                )}

                {options && options.formasPago.length === 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    No hay una forma activa de CHEQUE o TRANSFERENCIA BANCARIA para este flujo.
                  </div>
                )}

                {options && !options.bancosConfigurados && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Falta instalar la integración de ejecución con Bancos antes de generar el medio de pago.
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setCreateOpen(false)}
                  >
                    Cancelar
                  </Button>

                  <Button
                    disabled={
                      busy ||
                      !provider ||
                      chosen.length === 0 ||
                      !origin ||
                      !destination ||
                      !paymentMethod ||
                      !date
                    }
                    onClick={create}
                  >
                    Crear contraseña ({chosen.length})
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TÍTULO */}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Gestión de Cuentas por Pagar
            </h1>
            <p className="text-sm text-slate-500">
              Seguimiento del proceso completo, desde la recepción de la factura hasta su aplicación y cierre.
            </p>
          </div>

          {actor && bandeja === 'contrasenas' && can('CREAR') && (
            <Button onClick={() => setCreateOpen(true)} disabled={busy}>
              + Nueva contraseña
            </Button>
          )}
        </div>

        {/* MENSAJES */}

        {success && !selected && (
          <div
            role="status"
            className="rounded-lg bg-green-50 p-4 text-green-800"
          >
            {success}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {/* USUARIO OPERATIVO */}

        <section className="rounded-xl border border-slate-200 bg-white p-4">

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Usuario
                operativo
              </p>

              <p className="text-xs text-slate-500">
                Las acciones del
                proceso quedan
                registradas con
                este usuario de
                Oracle.
              </p>
            </div>

            <div className="min-w-0 md:w-80">

              <Select
                label="Operando como"
                value={actorId}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>,
                ) =>
                  cambiarActor(
                    event.target
                      .value,
                  )
                }
                disabled={busy}
                options={[
                  {
                    value: '',
                    label:
                      'Seleccionar usuario…',
                  },

                  ...usuarios.map(
                    usuario => ({
                      value:
                        String(
                          usuario.id,
                        ),

                      label:
                        `${usuario.nombre} · Usuario #${usuario.id}`,
                    }),
                  ),
                ]}
              />

            </div>

          </div>

          {actor && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">

              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                ID #
                {actor.id}
              </span>

            </div>
          )}

        </section>

        {/* BANDEJA OPERATIVA / RESUMEN DEL FLUJO */}

        {actor && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVistaResumen('activos')}
                    className={[
                      'rounded-lg border px-4 py-2 text-sm font-semibold transition',
                      vistaResumen === 'activos'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    Activas / En proceso
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
                      {activeOverview.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVistaResumen('historial')}
                    className={[
                      'rounded-lg border px-4 py-2 text-sm font-semibold transition',
                      vistaResumen === 'historial'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    Historial / Finalizadas y rechazadas
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
                      {historyOverview.length}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Bandeja operativa de procesos de CXP
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">
                      Flujo de Cuentas por Pagar
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      8 etapas
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Hacé clic en una etapa para ir directamente a su bandeja de trabajo.
                  </p>
                </div>

                <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {overviewLoading
                    ? 'Actualizando resumen…'
                    : `${overview.length} procesos registrados`}
                </span>
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="relative grid min-w-[980px] grid-cols-8 gap-0">
                  <div
                    aria-hidden="true"
                    className="absolute left-[6%] right-[6%] top-[18px] h-0.5 bg-slate-200"
                  />

                  {flowGuide.map((step, index) => {
                    const routeIsCurrent = index === bandejaStep;

                    return (
                      <button
                        type="button"
                        key={`${step.label}-${index}`}
                        onClick={() => navigate(step.route)}
                        className="relative z-10 flex flex-col items-center px-2 text-center"
                      >
                        <span
                          className={[
                            'grid h-9 w-9 place-items-center rounded-full border-2 bg-white text-xs font-bold transition',
                            routeIsCurrent
                              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-50'
                              : 'border-slate-300 text-slate-500 hover:border-blue-300 hover:text-blue-600',
                          ].join(' ')}
                        >
                          {index + 1}
                        </span>

                        <strong
                          className={[
                            'mt-2 text-xs',
                            routeIsCurrent ? 'text-blue-700' : 'text-slate-700',
                          ].join(' ')}
                        >
                          {step.label}
                        </strong>

                        <small className="mt-0.5 text-[11px] text-slate-400">
                          {step.hint}
                        </small>

                        <span className="mt-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {flowCounts[index]} {index === 0 ? 'docs' : 'reg.'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="w-full lg:max-w-md">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Buscar proceso
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      ⌕
                    </span>
                    <input
                      value={processSearch}
                      onChange={event => setProcessSearch(event.target.value)}
                      placeholder="Buscar por contraseña, proveedor o factura…"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                  <label className="text-xs font-semibold text-slate-600">
                    Etapa
                    <select
                      value={dashboardStage}
                      onChange={event => setDashboardStage(event.target.value)}
                      className="mt-1 block h-10 min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700"
                    >
                      <option value="all">Todas las etapas</option>
                      {flowGuide.map((step, index) => (
                        <option key={step.label} value={String(index)}>
                          {step.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold text-slate-600">
                    Estado
                    <select
                      value={dashboardStatus}
                      onChange={event => setDashboardStatus(event.target.value)}
                      className="mt-1 block h-10 min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700"
                    >
                      <option value="">Todos los estados</option>
                      {Object.entries(titles).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Button
                    variant="secondary"
                    disabled={busy || overviewLoading}
                    onClick={() =>
                      run(async () => {
                        await refresh(1);
                        await refreshOverview();
                      })
                    }
                  >
                    Actualizar
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Contraseña</th>
                      <th className="px-4 py-3 text-left">Proveedor</th>
                      <th className="px-4 py-3 text-left">Documentos</th>
                      <th className="px-4 py-3 text-right">Importe</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Etapa del proceso</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleOverview.map(process => (
                      <tr
                        key={process.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3 font-semibold text-blue-700">
                          {process.codigo}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {process.proveedorNombre ?? `Proveedor #${process.proveedor}`}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {process.documentos.length}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {money(process.total, process.moneda)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {titles[process.estado]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
                            <span className="grid h-5 w-5 place-items-center rounded bg-blue-50 text-[10px] font-bold text-blue-700">
                              {indiceEtapaProceso(process) + 1}
                            </span>
                            {nombreEtapa(process)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => gestionarProceso(process)}
                            className="font-semibold text-blue-700 hover:text-blue-900"
                          >
                            Gestionar →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {visibleOverview.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No hay procesos para los filtros seleccionados.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Probá cambiando la vista, la etapa o el estado.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                <span>
                  Mostrando {visibleOverview.length} de {baseOverview.length} procesos de esta vista.
                </span>
                <span>
                  {vistaResumen === 'activos'
                    ? 'Solo solicitudes vigentes en curso.'
                    : 'Procesos finalizados, rechazados o anulados.'}
                </span>
              </div>
            </section>
          </div>
        )}

        {/* SI NO HA SELECCIONADO USUARIO */}

        {!actor ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

            Seleccioná arriba
            el usuario con el
            que vas a realizar
            el proceso.

            {' '}

            No necesitás iniciar
            una segunda sesión
            dentro de Cuentas
            por Pagar.

          </div>
        ) : (
          <>

            {/* DETALLE */}

            {selected && (

              <div
                className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[1px]"
                role="dialog"
                aria-modal="true"
                aria-label={`Detalle del proceso ${selected.codigo}`}
                onMouseDown={event => {
                  if (event.target === event.currentTarget && !busy) {
                    setSelected(null);
                  }
                }}
              >
                <section className="max-h-[92vh] w-full max-w-5xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">

                <div className="flex items-center justify-between gap-3">

                  <h2 className="text-lg font-semibold">

                    {
                      selected.codigo
                    }

                    {' · '}

                    {
                      titles[
                        selected.estado
                      ]
                    }

                  </h2>

                  <div className="flex flex-wrap gap-2">

                    {!selected.cheque && !selected.transferencia && (

                      <Button
                        variant="secondary"
                        onClick={() =>
                          window.print()
                        }
                      >
                        Imprimir
                        contraseña
                      </Button>

                    )}

                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setSelected(null)}
                    >
                      Cerrar
                    </Button>

                  </div>

                </div>

                <p className="text-sm text-slate-600">

                  Siguiente paso:{' '}

                  {selected.estado ===
                  'EMITIDA'
                    ? 'solicitar autorización desde Contraseñas'
                    : selected.estado ===
                        'EN_REVISION'
                      ? 'revisión y aprobación en Autorizaciones'
                      : selected.estado ===
                          'APROBADA'
                        ? 'programar desde Pagos'
                        : selected.estado ===
                            'PROGRAMADA'
                          ? 'generar el medio de pago desde Ejecución de pago'
                          : 'consultar el estado e historial'}

                  .

                </p>

                {success && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>{success}</span>

                      {nextStage && (
                        <Button
                          onClick={() => {
                            sessionStorage.setItem(
                              'cxp.openProcessId',
                              String(selected.id),
                            );
                            setSelected(null);
                            navigate(nextStage.route);
                          }}
                        >
                          {nextStage.label}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {['PROGRAMADA', 'CHEQUE_EMITIDO'].includes(selected.estado) && scheduledDate && (
                  <div
                    className={`rounded-xl border p-4 ${
                      executionTooEarly
                        ? 'border-blue-200 bg-blue-50'
                        : executionOverdue
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg ${
                          executionTooEarly
                            ? 'bg-blue-100'
                            : executionOverdue
                              ? 'bg-amber-100'
                              : 'bg-emerald-100'
                        }`}
                      >
                        📅
                      </div>
                      <div>
                        <p
                          className={`font-semibold ${
                            executionTooEarly
                              ? 'text-blue-950'
                              : executionOverdue
                                ? 'text-amber-950'
                                : 'text-emerald-950'
                          }`}
                        >
                          {executionTooEarly
                            ? `Pago programado para ${formatDateGt(scheduledDate)}`
                            : executionOverdue
                              ? `Pago pendiente desde ${formatDateGt(scheduledDate)}`
                              : 'Pago disponible para ejecutar hoy'}
                        </p>
                        <p
                          className={`mt-1 text-sm ${
                            executionTooEarly
                              ? 'text-blue-800'
                              : executionOverdue
                                ? 'text-amber-900'
                                : 'text-emerald-800'
                          }`}
                        >
                          {executionTooEarly
                            ? `Faltan ${daysToScheduled} día${daysToScheduled === 1 ? '' : 's'}. El sistema habilitará la ejecución a partir de esa fecha.`
                            : executionOverdue
                              ? `Tiene ${Math.abs(daysToScheduled)} día${Math.abs(daysToScheduled) === 1 ? '' : 's'} de atraso. El pago puede ejecutarse y quedará trazabilidad de la fecha real.`
                              : 'La fecha programada ya fue alcanzada. Puede generarse o ejecutarse el medio de pago.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selected.estado === 'PROGRAMADA' &&
                  options &&
                  !options.bancosConfigurados && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-lg">
                          🏦
                        </div>
                        <div>
                          <p className="font-semibold text-amber-950">
                            Integración con Bancos no disponible
                          </p>
                          <p className="mt-1 text-sm text-amber-900">
                            El pago ya fue programado. Para continuar se requiere la integración de Bancos que genera el cheque o la transferencia según el medio seleccionado.
                          </p>
                          <p className="mt-2 text-xs text-amber-800">
                            No se utilizan mappings manuales ni instrumentos ficticios.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* CONSTANCIA IMPRIMIBLE */}

                <div
                  id="cxp-process-print"
                  className="space-y-2 rounded-lg border border-slate-200 p-4"
                >

                  <h3 className="font-bold">

                    {selected.cheque
                      ? 'Constancia interna de cheque — no negociable'
                      : selected.transferencia
                        ? 'Constancia interna de transferencia'
                        : 'Contraseña de pago'}

                  </h3>

                  <p>

                    {
                      selected.codigo
                    }

                    {' · '}

                    {selected.proveedorNombre ??
                      `Proveedor #${selected.proveedor}`}

                    {' · '}

                    {money(
                      selected.total,
                      selected.moneda,
                    )}

                  </p>

                  <p className="text-sm">
                    Estado:{' '}
                    {
                      titles[
                        selected.estado
                      ]
                    }
                  </p>

                  <p className="text-sm">
                    Medio de pago: <strong>{selected.formaPagoNombre}</strong>
                  </p>

                  <ul className="text-sm">

                    {selected.documentos.map(
                      documento => (

                        <li
                          key={
                            documento.id
                          }
                        >

                          Documento{' '}
                          {
                            documento.numero
                          }

                          :{' '}

                          {money(
                            documento.importe,
                            selected.moneda,
                          )}

                        </li>

                      ),
                    )}

                  </ul>

                  {selected.cheque ? (
                    <>
                      <p>
                        Cheque: {selected.cheque.numero} · Estado: {selected.cheque.estado}
                      </p>
                      <p className="text-sm">
                        Registro de Bancos: {selected.cheque.id} · Reimpresiones solicitadas: {selected.reimpresiones}
                      </p>
                      {selected.receptor && (
                        <p className="text-sm">Recibido por: {selected.receptor}</p>
                      )}
                      <p className="text-sm">Este comprobante no sustituye al cheque bancario.</p>
                    </>
                  ) : selected.transferencia ? (
                    <>
                      <p>
                        Transferencia: {selected.transferencia.id} · Estado: {selected.transferencia.estado}
                      </p>
                      <p className="text-sm">
                        Cuenta Bancos origen: {selected.transferencia.cuentaOrigen}
                        {' · '}
                        Cuenta proveedor: {selected.transferencia.cuentaDestino}
                      </p>
                      {selected.transferencia.referencia && (
                        <p className="text-sm">Referencia bancaria: {selected.transferencia.referencia}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm">
                      Constancia de documentos recibidos para pago. No acredita la cancelación de la deuda.
                    </p>
                  )}

                </div>

                {/* SOLICITAR */}

                {bandeja ===
                  'contrasenas' &&
                  selected.estado ===
                    'EMITIDA' &&
                  can('CREAR') && (

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">

                      <div>

                        <p className="font-medium text-blue-900">
                          Solicitud
                          preparada
                        </p>

                        <p className="text-sm text-blue-700">
                          Las facturas
                          están
                          reservadas,
                          pero su saldo
                          todavía no se
                          ha afectado.
                        </p>

                      </div>

                      <Button
                        disabled={
                          busy
                        }
                        onClick={() =>
                          act({
                            accion:
                              'solicitar',

                            version:
                              selected.version,
                          })
                        }
                      >
                        Solicitar
                        autorización
                      </Button>

                    </div>
                  )}

                {/* APROBACIONES */}

                {selected.aprobaciones
                  .length > 0 && (

                  <div>

                    <h3 className="mb-2 font-semibold">
                      Aprobaciones
                      requeridas
                    </h3>

                    <div className="space-y-2">

                      {selected.aprobaciones.map(
                        approval => (

                          <div
                            className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm"
                            key={
                              approval.id
                            }
                          >

                            <span>

                              Nivel{' '}
                              {
                                approval.nivel
                              }

                              {' · '}

                              {
                                approval.nombre
                              }

                              {' · '}

                              {
                                approval.decision
                              }

                              {approval.usuario
                                ? ` · Usuario #${approval.usuario}`
                                : ''}

                            </span>

                            {bandeja ===
                              'autorizaciones' &&
                              selected.estado ===
                                'EN_REVISION' &&
                              approval.nivel ===
                                Math.min(
                                  ...selected.aprobaciones
                                    .filter(
                                      item =>
                                        item.decision ===
                                        'PENDIENTE',
                                    )
                                    .map(
                                      item =>
                                        item.nivel,
                                    ),
                                ) &&
                              approval.decision ===
                                'PENDIENTE' &&
                              can(
                                'APROBAR',
                              ) && (
                                <>

                                  <Button
                                    variant="success"
                                    disabled={
                                      busy
                                    }
                                    onClick={() =>
                                      act({
                                        accion:
                                          'aprobar',

                                        version:
                                          selected.version,

                                        idAprobacion:
                                          approval.id,
                                      })
                                    }
                                  >
                                    Aprobar
                                  </Button>

                                  <Button
                                    variant="danger"
                                    disabled={
                                      busy ||
                                      reason.trim()
                                        .length <
                                        5
                                    }
                                    onClick={() =>
                                      act({
                                        accion:
                                          'rechazar',

                                        version:
                                          selected.version,

                                        idAprobacion:
                                          approval.id,

                                        motivo:
                                          reason,
                                      })
                                    }
                                  >
                                    Rechazar
                                  </Button>

                                </>
                              )}

                          </div>

                        ),
                      )}

                    </div>

                  </div>

                )}

                {/* MOTIVO */}

                {selected.estado !==
                  'ANULADA' &&
                  (can(
                    'ANULAR',
                  ) ||
                    can(
                      'APROBAR',
                    ) ||
                    can(
                      'TESORERIA',
                    )) &&
                  input(
                    'Motivo de rechazo, anulación o reimpresión',
                    reason,
                    setReason,
                    {
                      maxLength:
                        1000,

                      placeholder:
                        'Ej. El proveedor solicita corregir la fecha del pago',
                    },
                  )}

                {/* ACCIONES */}

                <div className="flex flex-wrap items-end gap-3">

                  {/* PROGRAMAR */}

                  {bandeja ===
                    'pagos' &&
                    selected.estado ===
                      'APROBADA' &&
                    can(
                      'TESORERIA',
                    ) && (

                      <form
                        className="flex items-end gap-3"
                        onSubmit={
                          event => {
                            event.preventDefault();

                            void act({
                              accion:
                                'programar',

                              version:
                                selected.version,

                              fecha:
                                date,
                            });
                          }
                        }
                      >

                        {input(
                          'Fecha de pago',
                          date,
                          setDate,
                          {
                            type:
                              'date',

                            required:
                              true,

                            min:
                              today,
                          },
                        )}

                        <Button
                          type="submit"
                          disabled={
                            busy
                          }
                        >
                          Programar
                          pago
                        </Button>

                      </form>
                    )}

                  {/* GENERAR MEDIO DE PAGO */}

                  {bandeja ===
                    'cheques' &&
                    selected.estado ===
                      'PROGRAMADA' &&
                    can(
                      'TESORERIA',
                    ) && (

                      <Button
                        disabled={
                          busy ||
                          executionTooEarly ||
                          !options?.bancosConfigurados
                        }
                        onClick={() =>
                          act({
                            accion:
                              'emitir',

                            version:
                              selected.version,
                          })
                        }
                      >
                        {processIsCheque
                          ? 'Emitir cheque'
                          : processIsTransfer
                            ? 'Generar transferencia'
                            : 'Generar medio de pago'}
                      </Button>

                    )}

                  {/* EJECUTAR MEDIO DE PAGO */}

                  {bandeja ===
                    'cheques' &&
                    selected.estado ===
                      'CHEQUE_EMITIDO' &&
                    can(
                      'TESORERIA',
                    ) && (
                      <>

                        {processIsCheque && input(
                          'Persona que recibe el cheque',
                          receiver,
                          setReceiver,
                          {
                            maxLength:
                              200,

                            placeholder:
                              'Nombre completo del receptor',
                          },
                        )}

                        <Button
                          disabled={
                            busy ||
                            executionTooEarly ||
                            (processIsCheque && receiver.trim().length < 3)
                          }
                          onClick={() =>
                            act({
                              accion:
                                'entregar',

                              version:
                                selected.version,

                              ...(processIsCheque
                                ? { receptor: receiver }
                                : {}),
                            })
                          }
                        >
                          {processIsCheque
                            ? 'Entregar cheque y aplicar pago'
                            : 'Ejecutar transferencia y aplicar pago'}
                        </Button>

                      </>
                    )}

                  {/* FINALIZAR / CONCILIAR */}

                  {bandeja ===
                    'cheques' &&
                    selected.estado ===
                      'ENTREGADO' &&
                    can(
                      'TESORERIA',
                    ) && (

                      <Button
                        disabled={
                          busy
                        }
                        onClick={() =>
                          act({
                            accion:
                              'cobrar',

                            version:
                              selected.version,
                          })
                        }
                      >
                        {processIsCheque
                          ? 'Confirmar cobro y finalizar'
                          : 'Confirmar transferencia y finalizar'}
                      </Button>

                    )}

                  {/* REIMPRESIÓN */}

                  {bandeja ===
                    'cheques' &&
                    selected.cheque &&
                    selected.estado !==
                      'ANULADA' &&
                    can(
                      'TESORERIA',
                    ) && (

                      <Button
                        variant="secondary"
                        disabled={
                          busy ||
                          reason.trim()
                            .length <
                            5
                        }
                        onClick={() =>
                          act(
                            {
                              accion:
                                'reimprimir',

                              version:
                                selected.version,

                              motivo:
                                reason,
                            },

                            true,
                          )
                        }
                      >
                        Registrar
                        reimpresión de
                        constancia
                      </Button>

                    )}

                  {/* ANULAR */}

                  {![
                    'ANULADA',
                    'COBRADO',
                  ].includes(
                    selected.estado,
                  ) &&
                    can(
                      'ANULAR',
                    ) && (

                      <Button
                        variant="danger"
                        disabled={
                          busy ||
                          reason.trim()
                            .length <
                            5
                        }
                        onClick={() => {
                          if (
                            window.confirm(
                              '¿Anular esta contraseña y revertir sus aplicaciones, si existen? Se conservará el historial.',
                            )
                          ) {
                            void act({
                              accion:
                                'anular',

                              version:
                                selected.version,

                              motivo:
                                reason,
                            });
                          }
                        }}
                      >
                        Anular
                      </Button>

                    )}

                </div>

                {/* HISTORIAL */}

                <div>

                  <h3 className="mb-2 font-semibold">
                    Historial
                  </h3>

                  <ol className="divide-y text-sm">

                    {selected.historial.map(
                      (
                        event,
                        index,
                      ) => (

                        <li
                          className="py-2"
                          key={
                            index
                          }
                        >

                          <span className="font-medium">

                            {
                              event.accion
                            }

                            {' · '}

                            {
                              event.nombre
                            }

                          </span>

                          <span className="text-slate-500">

                            {' · '}

                            {
                              event.fecha
                            }{' '}

                            UTC

                          </span>

                          <p>
                            {
                              event.detalle
                            }
                          </p>

                        </li>

                      ),
                    )}

                  </ol>

                </div>

                </section>
              </div>
            )}

          </>
        )}
</div>
    </CxpLayout>
  );
}