import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, RefreshCw, ShieldCheck, Upload, XCircle } from 'lucide-react';
import type {
  CxpAplicacion, CxpArchivo, CxpDocumento, CxpDocumentoDetalle, CxpDocumentoTributo,
  CxpDocumentoExpediente, CxpRecord,
} from '@erp/contracts';
import { apiClient, ApiError, buildQueryString } from '../../../shared/api';
import { Modal } from '../../../shared/components';
import { Button, DataTable, TextArea } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { CxpDocumentoForm } from './components/DocumentoForm';
import { DocumentoCatalogPicker } from './components/DocumentoCatalogPicker';
import { DocumentoPagoPanel } from './components/DocumentoPagoPanel';
import { DocumentoFlow, DocumentoStatus, formatDocumentoDate, formatDocumentoMoney, readableState } from './documentoView';

type ValidationIssue = { campo: string; mensaje: string };
type DocumentoDteFile = {
  idArchivo: number; categoria: string; nombreArchivo: string; tamanoBytes: number;
  versionArchivo: number; disponible: boolean;
};

type ApprovalContext = {
  estadoDocumento: string;
  nivelActual: number | null;
  reglas: Array<{
    idRegla: number; nombreRegla: string; nivel: number; idRolAprobador: number;
    cantidadAprobadores: number; aprobacionesRegistradas: number; faltantes: number;
    estado: 'COMPLETA' | 'DISPONIBLE' | 'ESPERA_NIVEL';
  }>;
  decisiones: Array<{
    idAprobacion: number; idRegla: number | null; nivel: number; idRolAprobador: number;
    idUsuarioAprobador: number | null; estado: string; accion: string | null;
    fechaDecision: string | null; observacion: string | null;
  }>;
  actor: null | {
    idUsuario: number; nombre: string | null; idRol: number | null; puedeDecidir: boolean;
    reglasDisponibles: number[]; impedimento: string | null;
  };
  impedimento: string | null;
};

const payableStates = new Set([
  'APROBADA', 'CONTABILIZADA', 'PENDIENTE_PAGO', 'PROGRAMADA_PAGO',
  'PARCIALMENTE_PAGADA', 'PARCIALMENTE_APLICADA', 'VENCIDA',
]);

const fieldLabels: Record<string, string> = {
  idProveedor: 'Proveedor', idSucursal: 'Sucursal', tipoDocumento: 'Tipo de documento',
  fechaDocumento: 'Fecha del documento', moneda: 'Moneda', uuidFiscal: 'UUID fiscal',
  serie: 'Serie', numeroDocumento: 'Número', totalNeto: 'Total neto',
  totalBruto: 'Total bruto', totalLocal: 'Total local', saldoPendiente: 'Saldo pendiente',
  subtotal: 'Subtotal', descuentoTotal: 'Descuento', impuestoTotal: 'Impuesto',
  retencionTotal: 'Retención', montoAplicado: 'Monto aplicado',
  detalles: 'Líneas', archivos: 'DTE adjunto',
};

function issueLabel(field: string) {
  const child = field.match(/^(detalles|tributos)\[(\d+)\]\.(.+)$/);
  if (child) return `${child[1] === 'detalles' ? 'Línea' : 'Tributo'} ${Number(child[2]) + 1} · ${readableState(child[3])}`;
  return fieldLabels[field] ?? readableState(field);
}

function nextStep(documento: CxpDocumento, lineas: CxpDocumentoDetalle[], hasDte: boolean) {
  switch (documento.estado) {
    case 'RECIBIDO':
      return {
        title: !documento.idProveedor ? 'Completa el proveedor' : !hasDte ? 'Adjunta el DTE' : !lineas.length ? 'Agrega las líneas del documento' : 'Valida el documento',
        description: 'Adjunta el comprobante y revisa cabecera, líneas, tributos e importes antes de enviarlo a aprobación.',
        blocker: !documento.idProveedor ? 'Falta seleccionar el proveedor.' : !hasDte ? 'RF04 requiere el contenido del DTE.' : !lineas.length ? 'Debe tener al menos una línea para avanzar.' : null,
      };
    case 'PENDIENTE_APROBACION':
      return { title: 'Registrar la decisión requerida', description: 'La validación terminó. Identifica al responsable y completa las aprobaciones configuradas.',
        blocker: 'Mientras espera aprobación no puede recibir aplicaciones.' };
    case 'APROBADA':
      return { title: 'Aplicar un pago disponible', description: 'Selecciona un pago ejecutado o confirmado, indica el importe y confirma la aplicación.',
        blocker: Number(documento.saldoPendiente) <= 0 ? 'No hay saldo disponible para una nueva aplicación.' : null };
    case 'PARCIALMENTE_PAGADA':
    case 'PENDIENTE_PAGO':
    case 'PROGRAMADA_PAGO':
    case 'CONTABILIZADA':
    case 'PARCIALMENTE_APLICADA':
      return { title: 'Continuar con el saldo pendiente', description: 'Puedes aplicar otro pago disponible hasta cubrir el saldo.', blocker: null };
    case 'CON_DIFERENCIAS':
      return { title: 'Resolver diferencias', description: 'Compara cabecera, líneas y tributos para identificar la discrepancia.',
        blocker: 'Debe resolverse la diferencia antes de continuar.' };
    case 'BLOQUEADA':
      return { title: 'Resolver el bloqueo', description: 'Consulta el motivo en la cabecera y coordina su resolución.',
        blocker: 'El documento bloqueado no puede recibir aplicaciones.' };
    case 'VENCIDA':
      return { title: 'Atender el vencimiento', description: 'Revisa el saldo y aplica un pago disponible para reducirlo.',
        blocker: null };
    case 'ANULADA':
      return { title: 'Conservar historial', description: 'El documento fue anulado.',
        blocker: 'Un documento anulado no continúa a aprobación, pago ni aplicación.' };
    default:
      return { title: ['PAGADA', 'APLICADA', 'CERRADA'].includes(documento.estado) ? 'Proceso concluido' : 'Revisar estado actual',
        description: `Estado registrado: ${readableState(documento.estado)}.`,
        blocker: ['PAGADA', 'APLICADA', 'CERRADA'].includes(documento.estado) ? null
          : 'Consulta al responsable antes de continuar.' };
  }
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="text-sm font-medium text-slate-900 mt-1 break-words">{value || '—'}</dd></div>;
}

export function CxpDocumentoExpedientePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [expediente, setExpediente] = useState<CxpDocumentoExpediente | null>(null);
  const [dteFiles, setDteFiles] = useState<DocumentoDteFile[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [approval, setApproval] = useState<ApprovalContext | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [actorId, setActorId] = useState('');
  const [observation, setObservation] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<number | null>(null);
  const [reverterId, setReverterId] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [reversalBusy, setReversalBusy] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(location.state?.created ? 'Documento recibido. Adjunta el DTE y completa sus líneas y tributos antes de validarlo.' : null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      apiClient.get<CxpDocumentoExpediente>(`/cxp/documentos/${id}/expediente`),
      apiClient.get<ApprovalContext>(`/cxp/documentos/${id}/aprobacion${buildQueryString({ actorId: actorId || undefined })}`),
      apiClient.get<DocumentoDteFile[]>(`/cxp/documentos/${id}/archivos`),
    ])
      .then(([result, approvalResult, files]) => { if (active) { setExpediente(result); setApproval(approvalResult); setDteFiles(files); } })
      .catch(reason => {
        if (!active) return;
        setExpediente(null);
        setLoadError(reason instanceof ApiError ? reason.message : 'No se pudo cargar el expediente.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, refresh]);

  useEffect(() => {
    if (!id || loading) return;
    let active = true;
    setApprovalLoading(true);
    setDecisionError(null);
    apiClient.get<ApprovalContext>(`/cxp/documentos/${id}/aprobacion${buildQueryString({ actorId: actorId || undefined })}`)
      .then(result => { if (active) setApproval(result); })
      .catch(reason => { if (active) setDecisionError(reason instanceof ApiError ? reason.message : 'No se pudo comprobar la autorización.'); })
      .finally(() => { if (active) setApprovalLoading(false); });
    return () => { active = false; };
  }, [id, actorId]);

  const validate = async () => {
    if (!id || validating || expediente?.documento.estado !== 'RECIBIDO') return;
    setValidating(true);
    setValidationError(null);
    setValidationIssues([]);
    setNotice(null);
    try {
      await apiClient.post(`/cxp/documentos/${id}/validar`, {});
      setNotice('Documento validado. Ahora está PENDIENTE_APROBACION y espera aprobación.');
      setRefresh(value => value + 1);
    } catch (reason) {
      setValidationError(reason instanceof ApiError ? reason.message : 'No se pudo validar el documento.');
      if (reason instanceof ApiError && Array.isArray(reason.details)) {
        setValidationIssues(reason.details.filter((item): item is ValidationIssue =>
          typeof item === 'object' && item !== null && typeof item.campo === 'string' && typeof item.mensaje === 'string'));
      }
    } finally { setValidating(false); }
  };

  const uploadDte = async () => {
    if (!id || !uploadFile || uploadBusy) return;
    setUploadBusy(true); setUploadError(null); setNotice(null);
    try {
      await apiClient.uploadDte(`/cxp/documentos/${id}/archivos`, uploadFile);
      setUploadFile(null);
      const input = window.document.getElementById('expediente-dte') as HTMLInputElement | null;
      if (input) input.value = '';
      setNotice('DTE adjuntado. Revisa las líneas y los tributos antes de validar.');
      setRefresh(value => value + 1);
    } catch (reason) {
      setUploadError(reason instanceof ApiError ? reason.message : 'No se pudo adjuntar el DTE.');
    } finally { setUploadBusy(false); }
  };

  const downloadDte = async (archivo: CxpArchivo) => {
    if (!id) return;
    setUploadError(null);
    try {
      const blob = await apiClient.download(`/cxp/documentos/${id}/archivos/${archivo.idArchivo}/descargar`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url; link.download = archivo.nombreArchivo; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setUploadError(reason instanceof ApiError ? reason.message : 'No se pudo descargar el DTE.');
    }
  };

  const decide = async (decision: 'APROBAR' | 'RECHAZAR', idRegla: number) => {
    if (!id || !actorId || decisionBusy) return;
    if (decision === 'RECHAZAR' && !observation.trim()) {
      setDecisionError('Indica el motivo del rechazo.');
      return;
    }
    if (!window.confirm(decision === 'APROBAR' ? '¿Confirmas la aprobación de este documento?'
      : '¿Confirmas el rechazo de este documento?')) return;
    setDecisionBusy(true);
    setDecisionError(null);
    setNotice(null);
    try {
      const result = await apiClient.post<ApprovalContext>(`/cxp/documentos/${id}/aprobacion`, {
        idRegla, idUsuarioAprobador: Number(actorId), decision,
        observacion: observation.trim() || null,
      });
      setApproval(result);
      setObservation('');
      setNotice(decision === 'RECHAZAR' ? 'Documento rechazado. La decisión y su motivo quedaron registrados.'
        : result.estadoDocumento === 'APROBADA' ? 'Documento aprobado. Ya puede continuar al proceso de pago o aplicación.'
          : 'Aprobación registrada. El documento sigue esperando las decisiones restantes.');
      setRefresh(value => value + 1);
    } catch (reason) {
      setDecisionError(reason instanceof ApiError ? reason.message : 'No se pudo registrar la decisión.');
    } finally { setDecisionBusy(false); }
  };

  const reversePayment = async () => {
    if (!id || !reversingId || !reverterId || !reversalReason.trim() || reversalBusy) return;
    if (!window.confirm('¿Confirmas la reversión de esta aplicación? El saldo del documento y del pago se restaurará.')) return;
    setReversalBusy(true); setReversalError(null);
    try {
      await apiClient.post(`/cxp/documentos/${id}/aplicaciones/${reversingId}/revertir`, {
        revertidoPor: Number(reverterId), motivoReverso: reversalReason.trim(),
      });
      setReversingId(null); setReverterId(''); setReversalReason('');
      setNotice('Aplicación revertida. Se actualizaron los saldos del documento y del pago.');
      setRefresh(value => value + 1);
    } catch (reason) {
      setReversalError(reason instanceof ApiError ? reason.message : 'No se pudo revertir la aplicación.');
    } finally { setReversalBusy(false); }
  };

  const document = expediente?.documento;
  const hasDte = dteFiles.some(file => file.categoria === 'DTE' && file.disponible);
  const guide = document ? nextStep(document, expediente.lineas, hasDte) : null;
  const currency = document?.moneda || 'GTQ';

  return <CxpLayout resource="documentos">
    <div className="space-y-5">
      <Link to="/cxp/documentos" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-700"><ArrowLeft size={16} /> Volver a documentos</Link>
      {loading && <div role="status" className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">Cargando expediente…</div>}
      {!loading && loadError && <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
        <p>{loadError}</p><Button variant="secondary" className="mt-3" onClick={() => setRefresh(value => value + 1)}>Reintentar</Button>
      </div>}
      {!loading && document && expediente && guide && <>
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5" aria-label="Resumen del documento">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Expediente · #{document.idDocumento}</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{[document.serie, document.numeroDocumento].filter(Boolean).join(' · ') || `Documento #${document.idDocumento}`}</h1>
                <DocumentoStatus estado={document.estado} />
              </div>
              <p className="text-sm text-slate-500 mt-1">{readableState(document.tipoDocumento)} · {document.proveedorNombre || (document.idProveedor ? `Proveedor #${document.idProveedor}` : 'Proveedor pendiente')}</p>
            </div>
            <dl className="flex flex-wrap gap-6">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo pendiente</dt>
                <dd className="text-xl font-bold text-blue-700 mt-1">{formatDocumentoMoney(document.saldoPendiente, currency)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vencimiento calculado</dt>
                <dd className="text-lg font-semibold text-slate-900 mt-1">{formatDocumentoDate(document.fechaVencimiento)}</dd>
                <p className="text-xs text-slate-500 mt-0.5">{Number(document.diasCredito) === 0 ? 'Contado' : `${document.diasCredito} días de crédito`}{document.idCondicionCredito ? ` · Condición #${document.idCondicionCredito}` : ''}</p></div>
            </dl>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 mt-4 pt-3 text-xs text-slate-600">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>Total neto <strong className="text-slate-900 ml-1">{formatDocumentoMoney(document.totalNeto, currency)}</strong></span>
              <span>Aplicado <strong className="text-slate-900 ml-1">{formatDocumentoMoney(document.montoAplicado, currency)}</strong></span>
            </div>
            <button type="button" onClick={() => setRefresh(value => value + 1)} className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-800"><RefreshCw size={14} /> Actualizar</button>
          </div>
        </section>

        <DocumentoFlow estado={document.estado} />

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5" aria-label="Siguiente paso">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Siguiente acción</p>
          <h2 className="text-lg font-bold text-slate-900 mt-1">{guide.title}</h2>
          <p className="text-sm text-slate-600 mt-1">{guide.description}</p>
          {guide.blocker && <p className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 text-sm text-amber-900">{guide.blocker}</p>}
          {document.estado === 'RECIBIDO' && <div className="flex flex-wrap items-center gap-2 mt-4">
            {!document.idProveedor ? <Button onClick={() => setEditing(true)}>Completar proveedor</Button>
              : !hasDte ? <Button icon={Upload} onClick={() => window.document.getElementById('expediente-dte')?.click()}>Adjuntar DTE</Button>
                : !expediente.lineas.length ? <Link to={`/cxp/documentos-detalle?filterField=idDocumento&filterValue=${document.idDocumento}`} className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">Gestionar líneas</Link>
                  : <Button icon={ShieldCheck} disabled={validating} onClick={validate}>{validating ? 'Validando…' : 'Validar documento'}</Button>}
            {hasDte && (!document.idProveedor || !expediente.lineas.length) && <Button variant="secondary" icon={ShieldCheck} disabled={validating} onClick={validate}>{validating ? 'Validando…' : 'Validar documento'}</Button>}
            {document.idProveedor && expediente.lineas.length > 0 && <Button variant="secondary" onClick={() => setEditing(true)}>Editar cabecera</Button>}
            {expediente.lineas.length > 0 && <Link to={`/cxp/documentos-detalle?filterField=idDocumento&filterValue=${document.idDocumento}`} className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100">Gestionar líneas</Link>}
            <Link to={`/cxp/documentos-tributos?filterField=idDocumento&filterValue=${document.idDocumento}`} className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100">Gestionar tributos</Link>
          </div>}
          {document.estado === 'PENDIENTE_APROBACION' && <div className="border-t border-slate-100 mt-4 pt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-4 items-start">
              <DocumentoCatalogPicker id="approval-actor" label="Responsable de la decisión" catalog="usuarios"
                value={actorId} onChange={setActorId} placeholder="Buscar usuario responsable…" required />
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aprobaciones requeridas</p>
                {approvalLoading && <p className="text-sm text-slate-500 mt-2">Comprobando autorización…</p>}
                {!approvalLoading && approval?.reglas.length === 0 && <p className="text-sm text-amber-800 mt-2">
                  {approval.impedimento || 'No hay reglas aplicables para continuar.'}
                </p>}
                {!approvalLoading && approval?.reglas.map(rule => <div key={rule.idRegla}
                  className="flex flex-wrap items-center justify-between gap-2 mt-2 text-sm">
                  <span className="font-medium text-slate-800">Nivel {rule.nivel} · {rule.nombreRegla}</span>
                  <span className={rule.estado === 'COMPLETA' ? 'text-emerald-700' : rule.estado === 'DISPONIBLE' ? 'text-blue-700' : 'text-slate-500'}>
                    {rule.estado === 'COMPLETA' ? 'Completa' : `${rule.aprobacionesRegistradas}/${rule.cantidadAprobadores} aprobaciones`}
                  </span>
                </div>)}
              </div>
            </div>
            {!actorId && <p className="text-sm text-slate-600">Selecciona al responsable para comprobar qué decisión puede registrar.</p>}
            {actorId && approval?.actor?.impedimento && <p className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900">
              {approval.actor.impedimento}
            </p>}
            {approval?.actor?.puedeDecidir && <div className="space-y-3">
              <TextArea label="Observación o motivo" value={observation} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setObservation(event.target.value)}
                rows={3} maxLength={1000} helperText="La observación es opcional al aprobar y obligatoria al rechazar." />
              <div className="flex flex-wrap gap-2">
                {approval.actor.reglasDisponibles.map(idRegla => <div key={idRegla} className="flex flex-wrap gap-2">
                  <Button variant="success" icon={CheckCircle2} disabled={decisionBusy} onClick={() => decide('APROBAR', idRegla)}>
                    {decisionBusy ? 'Registrando…' : 'Aprobar documento'}
                  </Button>
                  <Button variant="danger" icon={XCircle} disabled={decisionBusy} onClick={() => decide('RECHAZAR', idRegla)}>
                    Rechazar documento
                  </Button>
                </div>)}
              </div>
            </div>}
            {decisionError && <p role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">{decisionError}</p>}
          </div>}
          {payableStates.has(document.estado) && Number(document.saldoPendiente) > 0 &&
            <DocumentoPagoPanel documento={document} onApplied={application => {
              setNotice(`Pago aplicado. El saldo pendiente es ${formatDocumentoMoney(application.saldoPosterior, document.moneda)}.`);
              setRefresh(value => value + 1);
            }} />}
          {validationError && <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4 text-sm text-red-800">
            <p className="font-semibold">{validationError}</p>
            {validationIssues.length > 0 && <ul className="list-disc pl-5 mt-2 space-y-1">
              {validationIssues.map((issue, index) => <li key={`${issue.campo}-${index}`}><strong>{issueLabel(issue.campo)}:</strong> {issue.mensaje}</li>)}
            </ul>}
          </div>}
          {notice && <p role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg p-3 mt-4">{notice}</p>}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5" aria-label="Cabecera del documento">
          <h2 className="font-bold text-slate-900 mb-4">Cabecera</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <Info label="Proveedor" value={document.proveedorNombre || (document.idProveedor ? `#${document.idProveedor}` : null)} />
            <Info label="Tipo" value={readableState(document.tipoDocumento)} />
            <Info label="Fecha del documento" value={formatDocumentoDate(document.fechaDocumento)} />
            <Info label="Vencimiento" value={formatDocumentoDate(document.fechaVencimiento)} />
            <Info label="Origen" value={readableState(document.origenIngreso)} />
            <Info label="UUID fiscal" value={document.uuidFiscal} />
            <Info label="Hash de origen" value={document.hashOrigen} />
            <Info label="Motivo de bloqueo o rechazo" value={document.motivoBloqueo || document.motivoRechazo} />
          </dl>
        </section>

        <section className="space-y-3" aria-label="Líneas del documento">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">Líneas <span className="text-slate-400 font-medium">({expediente.lineas.length})</span></h2></div>
          <DataTable data={expediente.lineas} emptyText="Este documento todavía no tiene líneas."
            columns={[
              { header: '#', accessorKey: 'numeroLinea' },
              { header: 'Descripción', accessorKey: 'descripcion' },
              { header: 'Cantidad', accessorKey: 'cantidad', align: 'right' },
              { header: 'Precio unitario', align: 'right', cell: ({ row }: { row: CxpDocumentoDetalle }) => formatDocumentoMoney(row.precioUnitario, currency) },
              { header: 'Impuesto', align: 'right', cell: ({ row }: { row: CxpDocumentoDetalle }) => formatDocumentoMoney(row.impuesto, currency) },
              { header: 'Total línea', align: 'right', cell: ({ row }: { row: CxpDocumentoDetalle }) => <strong>{formatDocumentoMoney(row.totalLinea, currency)}</strong> },
            ]} />
        </section>

        <section className="space-y-3" aria-label="Tributos del documento">
          <h2 className="font-bold text-slate-900">Tributos <span className="text-slate-400 font-medium">({expediente.tributos.length})</span></h2>
          <DataTable data={expediente.tributos} emptyText="No hay tributos asociados a este documento."
            columns={[
              { header: 'Tipo', cell: ({ row }: { row: CxpDocumentoTributo }) => readableState(row.tipoTributo) },
              { header: 'Código', accessorKey: 'codigoTributo' },
              { header: 'Base', align: 'right', cell: ({ row }: { row: CxpDocumentoTributo }) => formatDocumentoMoney(row.baseImponible, currency) },
              { header: 'Monto', align: 'right', cell: ({ row }: { row: CxpDocumentoTributo }) => formatDocumentoMoney(row.monto, currency) },
              { header: 'Incluido en precio', cell: ({ row }: { row: CxpDocumentoTributo }) => row.incluidoPrecio === 'S' ? 'Sí' : 'No' },
              { header: 'Estado', cell: ({ row }: { row: CxpDocumentoTributo }) => readableState(row.estado) },
            ]} />
        </section>

        <section className="space-y-3" aria-label="Archivos asociados">
          <div><h2 className="font-bold text-slate-900">Archivos <span className="text-slate-400 font-medium">({expediente.archivos.length})</span></h2>
            <p className="text-xs text-slate-500 mt-1">Archivos relacionados con el documento o sus aplicaciones.</p></div>
          {document.estado === 'RECIBIDO' && !hasDte && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <label htmlFor="expediente-dte" className="block text-sm font-semibold text-blue-900">Adjuntar contenido del DTE (PDF o XML)</label>
            <input id="expediente-dte" type="file" accept=".pdf,.xml,application/pdf,application/xml,text/xml"
              onChange={event => setUploadFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-700" />
            <p className="text-xs text-blue-800">El contenido se conserva con su expediente. Después completa líneas y tributos; la carga no extrae los datos automáticamente.</p>
            <Button icon={Upload} disabled={!uploadFile || uploadBusy} onClick={uploadDte}>{uploadBusy ? 'Adjuntando…' : 'Adjuntar DTE'}</Button>
          </div>}
          {uploadError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{uploadError}</p>}
          <DataTable data={expediente.archivos} emptyText="No hay archivos asociados."
            columns={[
              { header: 'Nombre', accessorKey: 'nombreArchivo' },
              { header: 'Categoría', cell: ({ row }: { row: CxpArchivo }) => readableState(row.categoria) },
              { header: 'Relacionado con', cell: ({ row }: { row: CxpArchivo }) => row.idAplicacion ? `Aplicación #${row.idAplicacion}` : 'Documento' },
              { header: 'Versión', accessorKey: 'versionArchivo' },
              { header: 'Fecha', cell: ({ row }: { row: CxpArchivo }) => formatDocumentoDate(row.fechaCarga) },
              { header: 'Contenido', cell: ({ row }: { row: CxpArchivo }) => {
                const file = dteFiles.find(item => item.idArchivo === row.idArchivo);
                return file?.disponible ? <Button variant="secondary" icon={Download} onClick={() => downloadDte(row)}>Descargar</Button>
                  : <span className="text-xs text-slate-500">{file ? 'No disponible en este almacenamiento' : 'Solo metadatos'}</span>;
              } },
            ]} />
        </section>

        <section className="space-y-3" aria-label="Historial de aprobación">
          <h2 className="font-bold text-slate-900">Aprobaciones <span className="text-slate-400 font-medium">({approval?.decisiones.length ?? 0})</span></h2>
          <DataTable data={approval?.decisiones ?? []} emptyText="Todavía no hay decisiones registradas para este documento."
            columns={[
              { header: 'Nivel', accessorKey: 'nivel' },
              { header: 'Decisión', cell: ({ row }: { row: ApprovalContext['decisiones'][number] }) => readableState(row.estado) },
              { header: 'Responsable', cell: ({ row }: { row: ApprovalContext['decisiones'][number] }) => row.idUsuarioAprobador ? `Usuario #${row.idUsuarioAprobador}` : '—' },
              { header: 'Fecha', cell: ({ row }: { row: ApprovalContext['decisiones'][number] }) => formatDocumentoDate(row.fechaDecision) },
              { header: 'Observación', cell: ({ row }: { row: ApprovalContext['decisiones'][number] }) => row.observacion || '—' },
            ]} />
        </section>

        <section className="space-y-3" aria-label="Aplicaciones del documento">
          <h2 className="font-bold text-slate-900">Aplicaciones <span className="text-slate-400 font-medium">({expediente.aplicaciones.length})</span></h2>
          <DataTable data={expediente.aplicaciones} emptyText="No hay aplicaciones asociadas a este documento."
            columns={[
              { header: 'ID', accessorKey: 'idAplicacion' },
              { header: 'Tipo', cell: ({ row }: { row: CxpAplicacion }) => readableState(row.tipoAplicacion) },
              { header: 'Origen', cell: ({ row }: { row: CxpAplicacion }) => row.idPago ? `Pago #${row.idPago}` : row.idDocumentoOrigen ? `Documento #${row.idDocumentoOrigen}` : row.idDocumentoCxc ? `CxC #${row.idDocumentoCxc}` : '—' },
              { header: 'Fecha', cell: ({ row }: { row: CxpAplicacion }) => formatDocumentoDate(row.fechaAplicacion) },
              { header: 'Monto', align: 'right', cell: ({ row }: { row: CxpAplicacion }) => formatDocumentoMoney(row.montoTotalAplicado, currency) },
              { header: 'Estado', cell: ({ row }: { row: CxpAplicacion }) => readableState(row.estado) },
              { header: 'Saldo después', align: 'right', cell: ({ row }: { row: CxpAplicacion }) => formatDocumentoMoney(row.saldoPosterior, currency) },
              { header: 'Acción', cell: ({ row }: { row: CxpDocumentoExpediente['aplicaciones'][number] }) =>
                row.codigoPagoProceso
                  ? <span className="text-xs text-slate-600">Gestionada en Pagos ({row.codigoPagoProceso}).{' '}
                    <Link to="/cxp/pagos" onClick={() => {
                      if (row.idPago) sessionStorage.setItem('cxp.openProcessId', String(row.idPago));
                    }} className="font-semibold text-blue-700 hover:underline">Abrir proceso</Link></span>
                  : row.estado === 'APLICADA' && row.tipoAplicacion === 'PAGO'
                    ? <Button variant="secondary" onClick={() => { setReversingId(row.idAplicacion); setReversalError(null); }}>Revertir</Button> : '—' },
            ]} />
        </section>

        <Modal isOpen={reversingId !== null} onClose={() => { if (!reversalBusy) setReversingId(null); }} title="Revertir aplicación de pago" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">La aplicación #{reversingId} quedará en el historial y se restaurarán los saldos.</p>
            <DocumentoCatalogPicker id="reversal-actor" label="Usuario que registra la reversión" catalog="usuarios"
              value={reverterId} onChange={setReverterId} required />
            <TextArea label="Motivo de reversión" value={reversalReason}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setReversalReason(event.target.value)}
              rows={3} maxLength={1000} />
            {reversalError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{reversalError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={reversalBusy} onClick={() => setReversingId(null)}>Cancelar</Button>
              <Button variant="danger" disabled={!reverterId || !reversalReason.trim() || reversalBusy} onClick={reversePayment}>
                {reversalBusy ? 'Revirtiendo…' : 'Confirmar reversión'}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={editing} onClose={() => setEditing(false)} title="Editar cabecera recibida" size="lg">
          {editing && <CxpDocumentoForm record={document as unknown as CxpRecord} onCancel={() => setEditing(false)} onSuccess={() => {
            setEditing(false); setRefresh(value => value + 1);
          }} />}
        </Modal>
      </>}
    </div>
  </CxpLayout>;
}
