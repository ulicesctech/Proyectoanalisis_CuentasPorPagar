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
import { ArrowLeft, Ban, Banknote, CalendarClock, CheckCircle2, Eye, Plus, Printer, RefreshCw, Send, X, XCircle } from 'lucide-react';

import { RelationSelect } from '../components/RelationSelect';
import { TextInput, TextArea, Select } from '../../../shared/ui-kit';
import { apiRequest, ApiError } from '../../../shared/api';
import { CxpLayout } from '../CxpLayout';
import { CxpButton as Button } from '../components/CxpButton';

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

const lanePresentation: Record<BandejaProceso, { title: string; description: string }> = {
  contrasenas: { title: 'Contraseñas de pago', description: 'Prepará solicitudes y consultá el avance de los pagos a proveedores.' },
  autorizaciones: { title: 'Autorizaciones de pago', description: 'Revisá las solicitudes pendientes y registrá tus decisiones.' },
  pagos: { title: 'Programación de pagos', description: 'Programá las solicitudes aprobadas y consultá sus vencimientos.' },
  cheques: { title: 'Ejecución de pagos', description: 'Gestioná la emisión, entrega y confirmación del medio de pago.' },
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
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const optionsAbort = useRef<AbortController | null>(null);
  const optionsRequest = useRef(0);
  const [selected, setSelected] = useState<ProcesoPago | null>(null);

  const [chosen, setChosen] = useState<number[]>([]);

  const key = useRef(crypto.randomUUID());

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const [providerLabel, setProviderLabel] = useState('');

  const [status, setStatus] = useState(
    bandeja === 'autorizaciones' ? 'EN_REVISION' : '',
  );

  const [success, setSuccess] = useState('');
  const [reason, setReason] = useState('');
  const [receiver, setReceiver] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const wizardRef = useRef<HTMLFormElement>(null);
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

  // Esta consulta no necesita recargar las cuatro bandejas del resumen.
  async function loadProviderOptions(query = search) {
    optionsAbort.current?.abort();
    const requestId = ++optionsRequest.current;
    const controller = new AbortController();
    optionsAbort.current = controller;
    let timedOut = false;
    setOptionsLoading(true);
    setOptionsError('');
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20000);
    try {
      const opts = await apiRequest<OpcionesProceso>(
        `/cxp/procesos/opciones?proveedor=${encodeURIComponent(provider)}&search=${encodeURIComponent(query.trim())}`,
        { headers, signal: controller.signal },
      );
      if (requestId !== optionsRequest.current) return;
      setOptions(previous => ({ ...opts, documentos: [
        ...opts.documentos,
        ...(previous?.documentos ?? []).filter(doc => chosen.includes(doc.id) &&
          doc.proveedor === Number(provider) && !opts.documentos.some(next => next.id === doc.id)),
      ] }));
    } catch (error) {
      if (requestId !== optionsRequest.current || (controller.signal.aborted && !timedOut)) return;
      setOptionsError(timedOut
        ? 'La consulta tardó más de 20 segundos. Comprobá la conexión e intentá nuevamente.'
        : error instanceof ApiError ? error.message : 'No se pudieron cargar las facturas. Comprobá que el servidor esté disponible.');
    } finally {
      window.clearTimeout(timeout);
      if (requestId === optionsRequest.current) setOptionsLoading(false);
    }
  }

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
    setOptions(previous => ({ ...opts, documentos: [
      ...opts.documentos,
      ...(previous?.documentos ?? []).filter(doc => chosen.includes(doc.id) &&
        doc.proveedor === Number(provider) && !opts.documentos.some(next => next.id === doc.id)),
    ] }));

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

          while (true) {
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
    bandeja,
  ]);

  useEffect(() => {
    if (!createOpen || !provider || !actorId) return;
    void loadProviderOptions();
    return () => {
      optionsAbort.current?.abort();
      optionsRequest.current += 1;
      setOptionsLoading(false);
    };
    // La búsqueda se ejecuta con su botón; el cambio de proveedor consulta sin filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, provider, actorId]);

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

  useEffect(() => {
    if (createOpen) wizardRef.current?.querySelector<HTMLElement>('[data-step-title]')?.focus();
  }, [createOpen, createStep]);

  // Keep keyboard navigation inside the active dialog and restore the opener.
  useEffect(() => {
    if (!createOpen && !selected && !modalError) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      const dialogs = document.querySelectorAll<HTMLElement>('.cxp-process-page [aria-modal="true"]');
      const dialog = modalError ? document.querySelector<HTMLElement>('[role="alertdialog"]') : dialogs[dialogs.length - 1];
      dialog?.querySelector<HTMLElement>('button, input, select, [tabindex="-1"]')?.focus();
    }, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        if (modalError) setModalError('');
        else if (document.querySelector('[data-provider-dialog]')) return;
        else if (createOpen) setCreateOpen(false);
        else setSelected(null);
      }
      if (event.key !== 'Tab') return;
      const dialogs = document.querySelectorAll<HTMLElement>('.cxp-process-page [aria-modal="true"]');
      const dialog = modalError ? document.querySelector<HTMLElement>('[role="alertdialog"]') : dialogs[dialogs.length - 1];
      const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, a[href], [tabindex="0"]') ?? [])
        .filter(control => !control.matches(':disabled') && control.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(timer); document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); opener?.focus(); };
  }, [createOpen, Boolean(selected), Boolean(modalError), busy]);

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
          () => printReceipt(),
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
      className={extra.type === 'date' ? 'cxp-field-date' : extra.type === 'number' ? 'cxp-field-number' : 'cxp-field-text'}
      disabled={busy}
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

  function printReceipt() {
    const panel = document.getElementById('cxp-process-print')?.closest('details');
    if (panel) panel.open = true;
    window.requestAnimationFrame(() => window.print());
  }

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

  const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normalizedProcessSearch = normalizeSearch(processSearch.trim());

  const visibleOverview = baseOverview.filter(process => {
    const matchesSearch =
      !normalizedProcessSearch ||
      normalizeSearch(process.codigo).includes(normalizedProcessSearch) ||
      normalizeSearch(process.proveedorNombre ?? '')
        .includes(normalizedProcessSearch) ||
      String(process.proveedor).includes(normalizedProcessSearch) ||
      process.documentos.some(documento =>
        normalizeSearch(documento.numero)
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
      searchQuery={processSearch}
      onSearchChange={setProcessSearch}
    >
      <div className="cxp-process-page cxp-workspace space-y-5">

        {/* MODAL DE PROCESAMIENTO */}

        {(busyModal || optionsLoading) && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <div className="cxp-feedback-dialog w-full max-w-sm">
              <p className="cxp-dialog-eyebrow">Operación en curso</p>

              <h2 className="text-base font-semibold text-slate-900">
                {optionsLoading ? 'Cargando facturas del proveedor…' : 'Procesando'}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                {optionsLoading ? 'Consultando facturas y cuentas disponibles. Puede tardar unos segundos.' : busyMessage}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Esperá un momento. No cierres esta ventana.
              </p>
              <div className="cxp-loading-track" aria-hidden="true"><span /></div>
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
            <div className="cxp-feedback-dialog cxp-feedback-dialog--error w-full max-w-md">
              <p className="cxp-dialog-eyebrow">Operación pendiente</p>

              <h2
                id="cxp-operation-error-title"
                className="mt-2 text-lg font-semibold text-slate-900"
              >
                No se pudo completar la operación
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
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

              <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
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
              if (event.target === event.currentTarget && !busy && !optionsLoading) {
                setCreateOpen(false);
              }
            }}
          >
            <section className="cxp-process-dialog cxp-create-dialog">
              <div className="cxp-dialog-heading">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Nueva contraseña de pago
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Seleccioná las facturas y cuentas relacionadas. La constancia reserva los documentos; todavía no disminuye su saldo.
                  </p>
                </div>

                <Button
                  icon={X}
                  size="md"
                  variant="secondary"
                  disabled={busy || optionsLoading}
                  onClick={() => setCreateOpen(false)}
                >
                  Cerrar
                </Button>
              </div>

              <form ref={wizardRef} className="cxp-dialog-body space-y-5" onSubmit={event => {
                event.preventDefault();
                if (busy || optionsLoading || optionsError || document.querySelector('[data-provider-dialog]')) return;
                if (createStep === 0 && (!provider || !chosen.length)) return;
                if (createStep >= 1 && (!origin || !destination || !paymentMethod || !date)) return;
                if (createStep < 2) setCreateStep(step => step + 1);
                else void create();
              }}>
                <ol className="cxp-wizard-progress" aria-label="Pasos para crear contraseña">
                  {['Facturas', 'Datos del pago', 'Revisar'].map((label, index) => <li key={label}
                    aria-current={createStep === index ? 'step' : undefined}>
                    <span>{index + 1}</span> {label}
                  </li>)}
                </ol>
                <h3 className="font-semibold" tabIndex={-1} data-step-title>
                  {['1. Seleccioná proveedor y facturas', '2. Indicá las cuentas y la fecha', '3. Revisá antes de crear'][createStep]}
                </h3>
                <fieldset hidden={createStep !== 0} disabled={busy || optionsLoading || createStep !== 0} className="space-y-5 min-w-0">
                <RelationSelect
                  catalog="proveedores"
                  id="cxp-process-provider"
                  onLabelChange={setProviderLabel}
                  label="Proveedor"
                  required
                  readOnly={busy || optionsLoading}
                  value={provider}
                  onChange={value => {
                    setProvider(value);
                    setSearch('');
                    setOptionsError('');
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
                    disabled={busy || optionsLoading || !provider}
                    onClick={() => void loadProviderOptions()}
                  >
                    Buscar
                  </Button>
                </div>

                {optionsError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p>{optionsError}</p>
                  <Button type="button" variant="secondary" disabled={optionsLoading} onClick={() => void loadProviderOptions()}>Reintentar carga de facturas</Button>
                </div>}

                <div className="overflow-hidden rounded-xl border border-slate-200" aria-busy={optionsLoading}>
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Facturas disponibles
                    </p>
                    <p className="text-xs text-slate-500">
                      Solo se permiten documentos compatibles del mismo proveedor, sucursal y moneda.
                    </p>
                  </div>

                  <div className="max-h-60 divide-y overflow-auto px-4">
                    {!optionsError && options?.documentos.map(documento => (
                      <label
                        key={documento.id}
                        className="flex cursor-pointer items-center gap-3 py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={chosen.includes(documento.id)}
                          disabled={
                            busy || optionsLoading || !!optionsError ||
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

                    {!optionsError && !optionsLoading && (!provider || options?.documentos.length === 0) && (
                      <p className="py-4 text-sm text-slate-500">
                        {provider
                          ? 'No hay facturas aprobadas con saldo disponible para este proveedor y los criterios actuales.'
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

                </fieldset>
                <fieldset hidden={createStep !== 1} disabled={busy || optionsLoading || createStep !== 1} className="space-y-5 min-w-0">
                <Select
                  className="cxp-field-text"
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

                </fieldset>
                {createStep === 2 && <div className="cxp-review space-y-3 rounded-xl bg-slate-50 p-4">
                  <p><strong>Proveedor:</strong> {providerLabel || `#${provider}`}</p>
                  <p><strong>Medio de pago:</strong> {selectedForm?.nombre}</p>
                  <p><strong>Cuenta de la empresa:</strong> {options?.origenes.find(c => String(c.id) === origin)?.nombre}</p>
                  <p><strong>Cuenta del proveedor:</strong> {options?.destinos.find(c => String(c.id) === destination)?.nombre}</p>
                  <p><strong>Fecha prevista:</strong> {formatDateGt(date)}</p>
                  <ul>{options?.documentos.filter(d => chosen.includes(d.id)).map(d =>
                    <li key={d.id}>{d.nombre} · {money(d.saldo, d.moneda)}</li>)}</ul>
                  <p className="text-lg font-bold">Total: {money(cxpMoneySum(...(options?.documentos.filter(d => chosen.includes(d.id)).map(d => d.saldo) ?? [])), options?.documentos.find(d => chosen.includes(d.id))?.moneda)}</p>
                  <p className="text-sm text-slate-600">Al crear se reservan las facturas. Su saldo todavía no cambia.</p>
                </div>}
                <div className="cxp-dialog-footer flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                  {createStep > 0 && <Button variant="secondary" disabled={busy || optionsLoading} onClick={() => setCreateStep(step => step - 1)}>Anterior</Button>}
                  {createStep < 2 && <Button type="submit" disabled={busy || optionsLoading || !!optionsError || (createStep === 0 ? !provider || !chosen.length : !origin || !destination || !paymentMethod || !date)}>Siguiente</Button>}

                  <Button
                    variant="secondary"
                    disabled={busy || optionsLoading}
                    onClick={() => setCreateOpen(false)}
                  >
                    Cancelar
                  </Button>

                  {createStep === 2 && <Button
                    type="submit"
                    disabled={
                      busy || optionsLoading || !!optionsError ||
                      !provider ||
                      chosen.length === 0 ||
                      !origin ||
                      !destination ||
                      !paymentMethod ||
                      !date
                    }
                  >
                    Crear contraseña ({chosen.length})
                  </Button>}
                </div>
              </form>
            </section>
          </div>
        )}

        <header className="cxp-workspace-header">
          <div className="cxp-workspace-heading">
            <button type="button" className="cxp-workspace-back" onClick={() => navigate('/cxp')}>
              <ArrowLeft size={14} aria-hidden="true" /> Cuentas por pagar
            </button>
            <h1>{lanePresentation[bandeja].title}</h1>
            <p>{lanePresentation[bandeja].description}</p>
          </div>
          <div className="cxp-workspace-context">
            <div className="cxp-workspace-operator">
              <Select label="Usuario operativo" value={actorId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => cambiarActor(event.target.value)}
                disabled={busy || optionsLoading}
                options={[{ value: '', label: 'Seleccionar usuario…' },
                  ...usuarios.map(usuario => ({ value: String(usuario.id), label: usuario.nombre }))]} />
            </div>
            {actor && bandeja === 'contrasenas' && can('CREAR') && (
              <Button icon={Plus} onClick={() => { setCreateStep(0); setCreateOpen(true); }} disabled={busy}>
                Nueva contraseña
              </Button>
            )}
          </div>
        </header>

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

        {/* BANDEJA OPERATIVA */}
        {actor && (
          <div className="space-y-4">
            <section className="cxp-workspace-card" aria-busy={overviewLoading}>
              <div className="cxp-workspace-card-heading">
                <div>
                  <h2>Solicitudes de pago</h2>
                  <p>{overviewLoading ? 'Actualizando solicitudes…' : `${overview.length} solicitudes registradas`}</p>
                </div>
                <div className="cxp-workspace-tools">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/cxp/lotes-pago')}>Lotes de pago</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/cxp/aplicaciones')}>Aplicaciones</Button>
                </div>
              </div>

              <details className="cxp-workspace-flow" open>
                <summary>
                  <span>Etapas del proceso</span>
                  <small>Consultá el flujo y navegá entre sus bandejas</small>
                </summary>
              <div className="overflow-x-auto pb-2">
                <div className="cxp-flow-grid relative grid grid-cols-8 gap-0">
                  <div
                    aria-hidden="true"
                    className="cxp-flow-line absolute left-[6%] right-[6%] top-[18px] h-0.5 bg-slate-200"
                  />

                  {flowGuide.map((step, index) => {
                    const routeIsCurrent = index === bandejaStep;

                    return (
                      <button
                        type="button"
                        key={`${step.label}-${index}`}
                        onClick={() => navigate(step.route)}
                        className="cxp-flow-tile relative z-10 flex flex-col items-center px-2 text-center"
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
              </details>

              <div className="cxp-workspace-views" aria-label="Vista de solicitudes">
                <Button variant={vistaResumen === 'activos' ? 'primary' : 'secondary'}
                  aria-pressed={vistaResumen === 'activos'} onClick={() => setVistaResumen('activos')}>
                  En proceso <span className="cxp-workspace-count">{activeOverview.length}</span>
                </Button>
                <Button variant={vistaResumen === 'historial' ? 'primary' : 'secondary'}
                  aria-pressed={vistaResumen === 'historial'} onClick={() => setVistaResumen('historial')}>
                  Historial <span className="cxp-workspace-count">{historyOverview.length}</span>
                </Button>
              </div>

              <div className="cxp-workspace-filters">
                <div className="cxp-workspace-search">
                  <label htmlFor="cxp-process-search">Buscar solicitud</label>
                  <div className="relative">
                    <input id="cxp-process-search" type="search" value={processSearch}
                      onChange={event => setProcessSearch(event.target.value)}
                      placeholder="Número, proveedor o factura…" />
                  </div>
                </div>
                <label>Etapa
                  <select value={dashboardStage} onChange={event => setDashboardStage(event.target.value)}>
                    <option value="all">Todas las etapas</option>
                    {flowGuide.map((step, index) => <option key={step.label} value={String(index)}>{step.label}</option>)}
                  </select>
                </label>
                <label>Estado
                  <select value={dashboardStatus} onChange={event => setDashboardStatus(event.target.value)}>
                    <option value="">Todos los estados</option>
                    {Object.entries(titles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <div className="cxp-workspace-filter-actions">
                  <Button icon={RefreshCw} variant="secondary" disabled={busy || overviewLoading}
                    onClick={() => run(async () => { await refresh(1); await refreshOverview(); })}>Actualizar</Button>
                  {(processSearch || dashboardStatus || dashboardStage !== 'all') &&
                    <Button variant="ghost" onClick={() => { setProcessSearch(''); setDashboardStatus(''); setDashboardStage('all'); }}>Limpiar filtros</Button>}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-sm">
                  <caption className="sr-only">Solicitudes de pago a proveedores</caption>
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
                          <span className={`cxp-workspace-status cxp-workspace-status--${process.estado}`}>
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
                          <Button icon={Eye} variant="secondary" onClick={() => gestionarProceso(process)}>Gestionar</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {visibleOverview.length === 0 && (
                <div className="cxp-workspace-empty" role="status">
                  <p>{overviewLoading ? 'Cargando solicitudes…' : overview.length === 0 ? 'Todavía no hay solicitudes registradas' : 'No hay solicitudes en esta vista'}</p>
                  <small>{overviewLoading ? 'Estamos consultando la información disponible.' : overview.length === 0 ? 'Las solicitudes aparecerán aquí cuando se registren.' : 'Probá otra búsqueda, etapa o estado.'}</small>
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
            Seleccioná un usuario operativo para consultar y gestionar las solicitudes de pago.
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
                <section className="cxp-process-dialog cxp-detail-dialog">
                  <header className="cxp-dialog-heading">
                    <div>
                      <p className="cxp-dialog-eyebrow">Detalle de pago</p>
                      <div className="cxp-dialog-title-row">
                        <h2>{selected.codigo}</h2>
                        <span className={'cxp-workspace-status cxp-workspace-status--' + selected.estado}>
                          {titles[selected.estado]}
                        </span>
                      </div>
                    </div>
                    <div className="cxp-dialog-heading-actions">
                      {!selected.cheque && !selected.transferencia && (
                        <Button variant="secondary" icon={Printer} size="md" onClick={() => printReceipt()}>
                          Imprimir contraseña
                        </Button>
                      )}
                      <Button variant="secondary" icon={X} size="md" disabled={busy} onClick={() => setSelected(null)}>
                        Cerrar
                      </Button>
                    </div>
                  </header>
                  <div className="cxp-dialog-body space-y-5">
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
                    className={`cxp-status-notice rounded-xl border p-4 ${
                      executionTooEarly
                        ? 'border-blue-200 bg-blue-50'
                        : executionOverdue
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      
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
                    <div className="cxp-status-notice rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        
                        <div>
                          <p className="font-semibold text-amber-950">
                            Integración con Bancos no disponible
                          </p>
                          <p className="mt-1 text-sm text-amber-900">
                            El pago ya fue programado. Para continuar se requiere la integración de Bancos que genera el cheque o la transferencia según el medio seleccionado.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* CONSTANCIA IMPRIMIBLE */}
                <details className="cxp-disclosure" open>
                  <summary>Resumen y constancia</summary>
                <div
                  id="cxp-process-print"
                  className="cxp-receipt"
                >
                  <h3 className="cxp-receipt-title">
                    {selected.cheque
                      ? 'Constancia interna de cheque - no negociable'
                      : selected.transferencia ? 'Constancia interna de transferencia' : 'Contraseña de pago'}
                  </h3>
                  <dl className="cxp-receipt-grid">
                    <div><dt>Proveedor</dt><dd>{selected.proveedorNombre ?? ('Proveedor #' + selected.proveedor)}</dd></div>
                    <div className="cxp-receipt-total"><dt>Importe de la solicitud</dt><dd>{money(selected.total, selected.moneda)}</dd></div>
                    <div><dt>Medio de pago</dt><dd>{selected.formaPagoNombre}</dd></div>
                    <div><dt>Estado</dt><dd>{titles[selected.estado]}</dd></div>
                    <div><dt>Número de contraseña</dt><dd>{selected.codigo}</dd></div>
                    <div><dt>Fecha programada</dt><dd>{selected.fechaProgramada ? formatDateGt(selected.fechaProgramada) : 'Por programar'}</dd></div>
                  </dl>
                  <div className="cxp-receipt-documents">
                    <h4>Documentos incluidos ({selected.documentos.length})</h4>
                    <ul>{selected.documentos.map(documento => (
                      <li key={documento.id}><span>{documento.numero}</span><strong>{money(documento.importe, selected.moneda)}</strong></li>
                    ))}</ul>
                  </div>
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

                </details>
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

                      <Button icon={Send} size="md"
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

                  <details className="cxp-disclosure" open={selected.estado === 'EN_REVISION'}>
                    <summary>Aprobaciones requeridas ({selected.aprobaciones.length})</summary>

                    <div className="space-y-2">

                      {selected.aprobaciones.map(
                        approval => (

                          <div
                            className="cxp-approval-row"
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
                                    variant="success" icon={CheckCircle2} size="md"
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
                                    variant="danger" icon={XCircle} size="md"
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

                  </details>

                )}

                {/* MOTIVO */}
                {selected.estado !== 'ANULADA' && (can('ANULAR') || can('APROBAR') || can('TESORERIA')) &&
                  <TextArea label="Motivo de rechazo, anulación o reimpresión" value={reason}
                    rows={3} maxLength={1000} isReadOnly={busy}
                    helperText="Entre 5 y 1000 caracteres cuando la acción requiere un motivo."
                    placeholder="Ej. El proveedor solicita corregir la fecha del pago"
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)} />}

                {/* Los datos de la operación van arriba; todas las acciones comparten una fila. */}
                <div className="space-y-4">
                  {bandeja === 'pagos' && selected.estado === 'APROBADA' && can('TESORERIA') &&
                    input('Fecha de pago', date, setDate, {
                      type: 'date', required: true, min: today, form: 'cxp-programar-pago',
                    })}

                  {bandeja === 'cheques' && selected.estado === 'CHEQUE_EMITIDO' && can('TESORERIA') && processIsCheque &&
                    input('Persona que recibe el cheque', receiver, setReceiver, {
                      maxLength: 200, placeholder: 'Nombre completo del receptor',
                    })}

                  <div role="group" aria-label="Acciones del pago"
                    className="cxp-process-action-buttons flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                    {bandeja === 'pagos' && selected.estado === 'APROBADA' && can('TESORERIA') && (
                      <form id="cxp-programar-pago" className="flex" onSubmit={event => {
                        event.preventDefault();
                        void act({ accion: 'programar', version: selected.version, fecha: date });
                      }}>
                        <Button type="submit" icon={CalendarClock} size="md" variant="primary" disabled={busy}>
                          Programar pago
                        </Button>
                      </form>
                    )}

                    {bandeja === 'cheques' && selected.estado === 'PROGRAMADA' && can('TESORERIA') && (
                      <Button icon={Banknote} size="md" variant="primary"
                        disabled={busy || executionTooEarly || !options?.bancosConfigurados}
                        onClick={() => act({ accion: 'emitir', version: selected.version })}>
                        {processIsCheque ? 'Emitir cheque' : processIsTransfer ? 'Generar transferencia' : 'Generar medio de pago'}
                      </Button>
                    )}

                    {bandeja === 'cheques' && selected.estado === 'CHEQUE_EMITIDO' && can('TESORERIA') && (
                      <Button icon={CheckCircle2} size="md" variant="primary"
                        disabled={busy || executionTooEarly || (processIsCheque && receiver.trim().length < 3)}
                        onClick={() => act({ accion: 'entregar', version: selected.version,
                          ...(processIsCheque ? { receptor: receiver } : {}) })}>
                        {processIsCheque ? 'Entregar y aplicar pago' : 'Ejecutar y aplicar pago'}
                      </Button>
                    )}

                    {bandeja === 'cheques' && selected.estado === 'ENTREGADO' && can('TESORERIA') && (
                      <Button icon={CheckCircle2} size="md" variant="success" disabled={busy}
                        onClick={() => act({ accion: 'cobrar', version: selected.version })}>
                        {processIsCheque ? 'Confirmar cobro' : 'Confirmar transferencia'}
                      </Button>
                    )}

                    {bandeja === 'cheques' && selected.cheque && selected.estado !== 'ANULADA' && can('TESORERIA') && (
                      <Button icon={Printer} size="md" variant="secondary" disabled={busy || reason.trim().length < 5}
                        onClick={() => act({ accion: 'reimprimir', version: selected.version, motivo: reason }, true)}>
                        Reimprimir constancia
                      </Button>
                    )}

                    {!['ANULADA', 'COBRADO'].includes(selected.estado) && can('ANULAR') && (
                      <Button icon={Ban} size="md" variant="danger" disabled={busy || reason.trim().length < 5}
                        onClick={() => {
                          if (window.confirm('¿Anular esta contraseña y revertir sus aplicaciones, si existen? Se conservará el historial.')) {
                            void act({ accion: 'anular', version: selected.version, motivo: reason });
                          }
                        }}>
                        Anular
                      </Button>
                    )}
                  </div>
                </div>

                {/* HISTORIAL */}

                <details className="cxp-disclosure">
                  <summary>Historial ({selected.historial.length})</summary>

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
                </details>

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