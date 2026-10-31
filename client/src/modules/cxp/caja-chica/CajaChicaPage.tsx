import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, RefreshCw, Plus, CheckCircle2, AlertCircle,
  Eye, ExternalLink, ArrowRight, Coins, FileText, X,
  Printer, ArrowDownLeft, ArrowUpRight, Scale, Calendar
} from 'lucide-react';
import { CxpLayout } from '../CxpLayout';
import { CxpButton } from '../components/CxpButton';
import { CxpPageHeader } from '../components/CxpPageHeader';
import { apiClient, ApiError } from '../api';
import { cxpToday } from '@erp/contracts';
import { useAuth } from '../auth/session';
import './cajaChica.css';

export type BandejaCajaChica = 'fondos' | 'gastos' | 'reposiciones';

interface FondoCompromiso {
  idCompromiso: number;
  numeroReferencia: string;
  descripcion: string;
  montoTotal: number;
  saldoCapital: number;
  moneda: string;
  estado: string;
  idProveedor?: number;
  idDepartamento?: number;
  idSucursal?: number;
  responsablePor?: number;
  fechaInicio?: string;
  fechaFin?: string;
}

interface DocumentoGasto {
  idDocumento: number;
  idCompromiso?: number;
  idDocumentoRelacionado?: number;
  idProveedor?: number;
  idCondicionCredito?: number;
  tipoDocumento: string;
  serie?: string;
  numeroDocumento?: string;
  descripcion?: string;
  centroCosto?: string;
  moneda: string;
  subtotal: number;
  totalNeto: number;
  saldoPendiente: number;
  estado: string;
  fechaDocumento?: string;
}

function parseErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (Array.isArray(err.details) && err.details.length > 0) {
      const first = err.details[0];
      return `${first.campo ? `[${first.campo}]: ` : ''}${first.mensaje || err.message}`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado';
}


// Nomenclatura oficial: FONDO-CC-YYYY-NNN (Garantiza correlatividad y previene repeticiones)
function generarSiguienteReferenciaFondo(fondosActuales: FondoCompromiso[]): string {
  const anio = new Date().getFullYear();
  const regex = new RegExp(`^FONDO-CC--(\\d+)$`, 'i');
  let maxCorrelativo = 0;

  for (const f of fondosActuales) {
    const ref = f.numeroReferencia?.trim() || '';
    const match = ref.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxCorrelativo) maxCorrelativo = num;
    }
  }

  let siguiente = Math.max(maxCorrelativo + 1, fondosActuales.length + 1);
  let candidate = `FONDO-CC-${anio}-${String(siguiente).padStart(3, '0')}`;

  const existentes = new Set(fondosActuales.map(f => (f.numeroReferencia?.trim().toUpperCase() || '')));
  while (existentes.has(candidate.toUpperCase())) {
    siguiente++;
    candidate = `FONDO-CC-${anio}-${String(siguiente).padStart(3, '0')}`;
  }

  return candidate;
}

function generarSiguienteCorrelativoReposicion(reposActuales: DocumentoGasto[]): string {
  let maxNum = 0;
  for (const r of reposActuales) {
    const match = (r.numeroDocumento || '').match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  const siguiente = Math.max(maxNum + 1, reposActuales.length + 1);
  return String(siguiente).padStart(4, '0');
}

export function CajaChicaPage({ defaultBandeja = 'fondos' }: { defaultBandeja?: BandejaCajaChica }) {
  const { session } = useAuth();
  const [bandeja, setBandeja] = useState<BandejaCajaChica>(defaultBandeja);
  const [loading, setLoading] = useState(false);
  const [fondos, setFondos] = useState<FondoCompromiso[]>([]);
  const [gastos, setGastos] = useState<DocumentoGasto[]>([]);
  const [reposiciones, setReposiciones] = useState<DocumentoGasto[]>([]);
  
  // Modales
  const [modalFondoOpen, setModalFondoOpen] = useState(false);
  const [modalRepoOpen, setModalRepoOpen] = useState(false);
  const [fondoDetalle, setFondoDetalle] = useState<FondoCompromiso | null>(null);
  
  // Notificaciones
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fondo
  const [fondoRef, setFondoRef] = useState('');
  const [fondoDesc, setFondoDesc] = useState('');
  const [fondoMonto, setFondoMonto] = useState<number | ''>(500);
  const [fondoMoneda, setFondoMoneda] = useState('GTQ');
  const [fondoProveedor, setFondoProveedor] = useState<number>(1);
  const [fondoSucursal, setFondoSucursal] = useState<number>(1);
  const [fondoDepto, setFondoDepto] = useState<number>(1);


  // Apertura controlada de modales con nomenclatura automática
  function handleAbrirModalFondo() {
    const nuevoCodigo = generarSiguienteReferenciaFondo(fondos);
    setFondoRef(nuevoCodigo);
    setFondoDesc('');
    setFondoMonto(500);
    setErrorMsg(null);
    setModalFondoOpen(true);
  }

  function handleAbrirModalRepo(gasto: DocumentoGasto) {
    setRepoGastoSeleccionado(gasto);
    setRepoSerie('REP-CC');
    const proxNum = generarSiguienteCorrelativoReposicion(reposiciones);
    setRepoNumero(proxNum);
    setErrorMsg(null);
    setModalRepoOpen(true);
  }

  // Validación reactiva de referencia duplicada
  const esRefRepetida = useMemo(() => {
    if (!fondoRef.trim()) return false;
    return fondos.some(f => f.numeroReferencia?.trim().toUpperCase() === fondoRef.trim().toUpperCase());
  }, [fondos, fondoRef]);

  // Form Reposición
  const [repoGastoSeleccionado, setRepoGastoSeleccionado] = useState<DocumentoGasto | null>(null);
  const [repoSerie, setRepoSerie] = useState('REP-CC');
  const [repoNumero, setRepoNumero] = useState('');

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Cargar Fondos de Caja Chica vía API administrativa
      const resFondos = await apiClient.get<{ data: Array<{ registro: FondoCompromiso }> }>(
        '/cxp/administracion/compromisos?tipoCompromiso=FONDO_CAJA_CHICA&limit=50'
      );
      setFondos((resFondos.data || []).map(r => r.registro));

      // 2. Cargar Gastos (CXP_DOCUMENTO where tipoDocumento = 'GASTO_CAJA_CHICA')
      const resGastos = await apiClient.get<{ data: DocumentoGasto[] }>(
        '/cxp/documentos?filterField=tipoDocumento&filterValue=GASTO_CAJA_CHICA&limit=50'
      );
      setGastos(resGastos.data || []);

      // 3. Cargar Reposiciones (CXP_DOCUMENTO where tipoDocumento = 'REEMBOLSO')
      const resRepo = await apiClient.get<{ data: DocumentoGasto[] }>(
        '/cxp/documentos?filterField=tipoDocumento&filterValue=REEMBOLSO&limit=50'
      );
      setReposiciones(resRepo.data || []);
    } catch (err: unknown) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Creación de Fondo Fijo con validación estricta de unicidad
  async function handleCrearFondo(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const refLimpia = fondoRef.trim();
    if (!refLimpia) {
      setErrorMsg('La referencia de fondo es obligatoria');
      return;
    }
    if (esRefRepetida) {
      setErrorMsg(`La referencia "${refLimpia}" ya existe. Haz clic en "Regenerar" para obtener un código único.`);
      return;
    }
    if (!fondoMonto || fondoMonto <= 0) {
      setErrorMsg('El monto del fondo debe ser mayor a 0');
      return;
    }
    const currentActorId = session?.actor?.id || 1;
    try {
      await apiClient.post('/cxp/administracion/compromisos', {
        tipoCompromiso: 'FONDO_CAJA_CHICA',
        numeroReferencia: refLimpia,
        descripcion: fondoDesc.trim() || `Fondo de Caja Chica ${refLimpia}`,
        fechaInicio: cxpToday(),
        montoTotal: Number(fondoMonto),
        moneda: fondoMoneda,
        idProveedor: fondoProveedor || 1,
        idSucursal: fondoSucursal || 1,
        idDepartamento: fondoDepto || 1,
        responsablePor: currentActorId,
      });

      setSuccessMsg(`Fondo de caja chica "${refLimpia}" aperturado exitosamente por Q${Number(fondoMonto).toFixed(2)}`);
      setModalFondoOpen(false);
      setFondoRef('');
      setFondoDesc('');
      cargarDatos();
    } catch (err: unknown) {
      setErrorMsg(parseErrorMessage(err));
    }
  }

  // Creación de Reposición (RF-13)
  async function handleCrearReposicion(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!repoGastoSeleccionado) {
      setErrorMsg('Selecciona un gasto aprobado para reponer');
      return;
    }
    const currentActorId = session?.actor?.id || 1;
    const nowIsoDate = cxpToday();
    try {
      await apiClient.post('/cxp/documentos', {
        tipoDocumento: 'REEMBOLSO',
        idCompromiso: repoGastoSeleccionado.idCompromiso,
        idDocumentoRelacionado: repoGastoSeleccionado.idDocumento,
        idProveedor: repoGastoSeleccionado.idProveedor || 1,
        idSucursal: 1,
        // Condición obtenida automáticamente del comprobante para evitar errores al usuario
        idCondicionCredito: repoGastoSeleccionado.idCondicionCredito || 1,
        naturaleza: 'C',
        serie: repoSerie || 'REP-CC',
        numeroDocumento: repoNumero || `${Date.now().toString().slice(-6)}`,
        moneda: repoGastoSeleccionado.moneda || 'GTQ',
        tipoCambio: 1,
        subtotal: Number(repoGastoSeleccionado.totalNeto),
        descuentoTotal: 0,
        impuestoTotal: 0,
        retencionTotal: 0,
        recargoTotal: 0,
        gastoAdicionalTotal: 0,
        diferenciaRedondeo: 0,
        estado: 'RECIBIDO',
        fechaDocumento: nowIsoDate,
        fechaVencimiento: nowIsoDate,
        solicitadoPor: currentActorId,
        responsablePor: currentActorId,
      });

      setSuccessMsg(`Reposición registrada exitosamente por Q${Number(repoGastoSeleccionado.totalNeto).toFixed(2)}. Saldo enviado a restitución.`);
      setModalRepoOpen(false);
      setRepoGastoSeleccionado(null);
      cargarDatos();
    } catch (err: unknown) {
      setErrorMsg(parseErrorMessage(err));
    }
  }

  // Totales Generales y Cálculos por Mes
  const hoyIso = cxpToday();
  const mesActualClave = hoyIso.slice(0, 7); // e.g. "2026-10"
  const primerDiaMesActual = `${mesActualClave}-01`;

  const totalAsignado = fondos.reduce((acc, f) => acc + (Number(f.montoTotal) || 0), 0);
  const totalDisponible = fondos.reduce((acc, f) => acc + (Number(f.saldoCapital) || 0), 0);

  // Gastos del mes actual
  const gastosMesActual = gastos.filter(g => (g.fechaDocumento ?? '').startsWith(mesActualClave));
  const totalGastosMesActual = gastosMesActual.reduce((acc, g) => acc + (Number(g.totalNeto) || 0), 0);

  // Reintegros aplicados del mes actual
  const reintegrosMesActual = reposiciones.filter(r => (r.fechaDocumento ?? '').startsWith(mesActualClave) && r.estado === 'PAGADA');
  const totalReintegrosMesActual = reintegrosMesActual.reduce((acc, r) => acc + (Number(r.totalNeto) || 0), 0);

  // Gasto neto del mes actual (Gastos - Reintegros)
  const totalGastoNetoMesActual = Math.max(0, totalGastosMesActual - totalReintegrosMesActual);

  // Filtros de fecha para el modal de movimientos (por defecto el mes actual)
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(primerDiaMesActual);
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(hoyIso);

  // Movimientos combinados (Gastos y Reintegros) del fondo seleccionado
  const movimientosFondo = useMemo(() => {
    if (!fondoDetalle) return [];
    const fId = Number(fondoDetalle.idCompromiso);
    const gFondo = gastos.filter(g => Number(g.idCompromiso) === fId);
    const rFondo = reposiciones.filter(
      r => Number(r.idCompromiso) === fId || gFondo.some(g => Number(r.idDocumentoRelacionado) === Number(g.idDocumento))
    );

    const combinados = [
      ...gFondo.map(g => ({
        id: g.idDocumento,
        tipo: 'GASTO' as const,
        fecha: g.fechaDocumento || '',
        comprobante: g.serie ? `${g.serie}-${g.numeroDocumento}` : `#${g.idDocumento}`,
        descripcion: g.descripcion || (g as any).observaciones || `Gasto de caja chica (Prov #${g.idProveedor || 1})`,
        monto: Number(g.totalNeto) || 0,
        estado: g.estado,
      })),
      ...rFondo.map(r => ({
        id: r.idDocumento,
        tipo: 'REPOSICION' as const,
        fecha: r.fechaDocumento || '',
        comprobante: r.serie ? `${r.serie}-${r.numeroDocumento}` : `#${r.idDocumento}`,
        descripcion: `Reintegro a caja chica (Gasto #${(r as any).idDocumentoRelacionado || ''})`,
        monto: Number(r.totalNeto) || 0,
        estado: r.estado,
      })),
    ];

    return combinados.sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : b.id - a.id));
  }, [fondoDetalle, gastos, reposiciones]);

  const movimientosFiltrados = useMemo(() => {
    return movimientosFondo.filter(m => {
      const f = m.fecha.slice(0, 10);
      if (filtroFechaDesde && f < filtroFechaDesde) return false;
      if (filtroFechaHasta && f > filtroFechaHasta) return false;
      return true;
    });
  }, [movimientosFondo, filtroFechaDesde, filtroFechaHasta]);

  const totalGastosFiltrados = movimientosFiltrados
    .filter(m => m.tipo === 'GASTO')
    .reduce((acc, m) => acc + m.monto, 0);

  const totalReintegrosFiltrados = movimientosFiltrados
    .filter(m => m.tipo === 'REPOSICION' && m.estado === 'PAGADA')
    .reduce((acc, m) => acc + m.monto, 0);

  // Función de Exportación PDF con T Contable
  function handleExportarTContablePDF() {
    if (!fondoDetalle) return;
    const fondo = fondoDetalle;
    const entradas = movimientosFiltrados.filter(m => m.tipo === 'REPOSICION' && m.estado === 'PAGADA');
    const salidas = movimientosFiltrados.filter(m => m.tipo === 'GASTO');
    const totalEntradas = entradas.reduce((acc, m) => acc + m.monto, 0);
    const totalSalidas = salidas.reduce((acc, m) => acc + m.monto, 0);

    const saldoTeorico = Number(fondo.montoTotal) + totalEntradas - totalSalidas;
    const saldoRealSistema = Number(fondo.saldoCapital);
    const diferencia = Math.abs(saldoTeorico - saldoRealSistema);
    const cuadrado = diferencia < 0.01;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Por favor habilita las ventanas emergentes en tu navegador para generar el PDF.');
      return;
    }

    const fondoRefTxt = fondo.numeroReferencia || ('Fondo #' + fondo.idCompromiso);
    const fechaEmisionTxt = new Date().toLocaleDateString('es-GT');
    const monedaTxt = fondo.moneda || 'GTQ';

    let htmlEntradas = '<tr><td>' + (fondo.fechaInicio ? fondo.fechaInicio.slice(0, 10) : 'Inicial') + '</td><td><strong>APERTURA</strong></td><td>Fondo fijo asignado inicial</td><td class="amount">Q' + Number(fondo.montoTotal).toFixed(2) + '</td></tr>';
    if (entradas.length === 0) {
      htmlEntradas += '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">Sin reintegros en el período</td></tr>';
    } else {
      entradas.forEach(m => {
        htmlEntradas += '<tr><td>' + (m.fecha ? m.fecha.slice(0, 10) : '') + '</td><td><strong>' + m.comprobante + '</strong></td><td>' + m.descripcion + '</td><td class="amount">+Q' + m.monto.toFixed(2) + '</td></tr>';
      });
    }

    let htmlSalidas = '';
    if (salidas.length === 0) {
      htmlSalidas = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">Sin gastos en el período</td></tr>';
    } else {
      salidas.forEach(m => {
        htmlSalidas += '<tr><td>' + (m.fecha ? m.fecha.slice(0, 10) : '') + '</td><td><strong>' + m.comprobante + '</strong></td><td>' + m.descripcion + '</td><td class="amount" style="color: #dc2626;">-Q' + m.monto.toFixed(2) + '</td></tr>';
      });
    }

    const totalDebe = Number(fondo.montoTotal) + totalEntradas;
    const cardBorderColor = cuadrado ? '#10b981' : '#ef4444';
    const cardBgColor = cuadrado ? '#ecfdf5' : '#fef2f2';
    const cardTextColor = cuadrado ? '#065f46' : '#991b1b';
    const cardSubColor = cuadrado ? '#047857' : '#b91c1c';
    const cardStatusTxt = cuadrado ? '✓ FONDOS TOTALMENTE CUADRADOS' : '⚠ ALERTA DE DESCUADRE FINANCIERO';
    const cardDetailTxt = cuadrado
      ? 'La sumatoria del Debe menos el Haber coincide exactamente con el saldo disponible en caja y sistema.'
      : ('Existe una discrepancia contable de Q' + diferencia.toFixed(2) + ' entre los registros y el saldo disponible.');

    printWin.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>T_Contable_${fondoRefTxt}_${filtroFechaDesde}_${filtroFechaHasta}</title>
  <style>
    @page { size: letter portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 11px; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company-title { font-size: 16px; font-weight: bold; color: #0f172a; }
    .report-title { font-size: 13px; font-weight: 600; color: #2563eb; text-transform: uppercase; margin-top: 2px; }
    .meta-info { font-size: 10px; color: #64748b; text-align: right; }
    .summary-box { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 16px; }
    .summary-item { text-align: center; }
    .summary-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .summary-val { font-size: 13px; font-weight: bold; margin-top: 3px; color: #0f172a; }
    .t-chart-container { display: grid; grid-template-columns: 1fr 1fr; border: 2px solid #0f172a; border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
    .t-column { padding: 10px; }
    .t-left { border-right: 2px solid #0f172a; background: #fafafa; }
    .t-right { background: #ffffff; }
    .t-header { font-size: 12px; font-weight: bold; text-align: center; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase; }
    .t-left .t-header { color: #065f46; }
    .t-right .t-header { color: #991b1b; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { text-align: left; padding: 4px; color: #64748b; font-size: 9px; text-transform: uppercase; }
    td { padding: 5px 4px; border-bottom: 1px solid #f1f5f9; }
    .amount { text-align: right; font-weight: 600; font-family: monospace; }
    .total-row { border-top: 2px solid #0f172a; font-weight: bold; font-size: 11px; padding-top: 6px; }
    .cuadre-card { border: 1.5px solid ${cardBorderColor}; background: ${cardBgColor}; border-radius: 8px; padding: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .cuadre-status { font-size: 13px; font-weight: bold; color: ${cardTextColor}; }
    .cuadre-detail { font-size: 10px; color: ${cardSubColor}; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 10px; }
    .sig-line { border-top: 1px solid #94a3b8; text-align: center; padding-top: 6px; font-size: 10px; font-weight: 600; color: #334155; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">EMPRESA DEMO ERP • SISTEMA CXP</div>
      <div class="report-title">Libro de Caja Chica y T Contable</div>
      <div style="font-size: 11px; font-weight: 600; color: #334155; margin-top: 3px;">
        Fondo: ${fondoRefTxt} — ${fondo.descripcion}
      </div>
    </div>
    <div class="meta-info">
      <div><strong>Período Auditado:</strong> ${filtroFechaDesde} al ${filtroFechaHasta}</div>
      <div><strong>Fecha Emisión:</strong> ${fechaEmisionTxt}</div>
      <div><strong>Moneda:</strong> ${monedaTxt}</div>
    </div>
  </div>

  <div class="summary-box">
    <div class="summary-item">
      <div class="summary-label">Monto Asignado</div>
      <div class="summary-val">Q${Number(fondo.montoTotal).toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Saldo Disponible en Caja</div>
      <div class="summary-val" style="color: #059669;">Q${Number(fondo.saldoCapital).toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Egresos (Haber)</div>
      <div class="summary-val" style="color: #dc2626;">Q${totalSalidas.toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Reintegros Recibidos (Debe)</div>
      <div class="summary-val" style="color: #2563eb;">Q${totalEntradas.toFixed(2)}</div>
    </div>
  </div>

  <div class="t-chart-container">
    <div class="t-column t-left">
      <div class="t-header">DEBE (Ingresos / Reposiciones)</div>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Comprobante</th>
            <th>Concepto</th>
            <th style="text-align: right;">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${htmlEntradas}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="total-row">TOTAL DEBE (Créditos a favor):</td>
            <td class="amount total-row">Q${totalDebe.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="t-column t-right">
      <div class="t-header">HABER (Egresos / Gastos)</div>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Comprobante</th>
            <th>Concepto</th>
            <th style="text-align: right;">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${htmlSalidas}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="total-row">TOTAL HABER (Débitos por gastos):</td>
            <td class="amount total-row" style="color: #dc2626;">Q${totalSalidas.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>

  <div class="cuadre-card">
    <div>
      <div class="cuadre-status">${cardStatusTxt}</div>
      <div class="cuadre-detail">${cardDetailTxt}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 9px; text-transform: uppercase; color: #64748b;">Diferencia de Cuadre</div>
      <div style="font-size: 16px; font-weight: bold; color: ${cuadrado ? '#059669' : '#dc2626'};">
        Q${diferencia.toFixed(2)}
      </div>
    </div>
  </div>

  <div class="signatures">
    <div class="sig-line">
      Custodio Responsable de Caja Chica<br>
      <span style="font-size: 9px; color: #64748b;">Entregó comprobantes y efectivo</span>
    </div>
    <div class="sig-line">
      Revisor / Aprobador Cuentas por Pagar<br>
      <span style="font-size: 9px; color: #64748b;">Auditoría interna y conciliación</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`);
    printWin.document.close();
  }

  return (
    <CxpLayout>
      <div className="cxp-workspace space-y-5">
        
        {/* Cabecera estándar de CXP */}
        <CxpPageHeader
          title="Gestión de Caja Chica"
          group="Cuentas por Pagar • RF-11 a RF-13"
          description="Apertura de fondos fijos, control de movimientos por fondo y reposición de saldo."
          actions={
            <div className="flex items-center gap-2">
              <CxpButton
                variant="secondary"
                icon={RefreshCw}
                disabled={loading}
                onClick={cargarDatos}
              >
                Actualizar
              </CxpButton>
              <CxpButton
                variant="primary"
                icon={Plus}
                onClick={handleAbrirModalFondo}
              >
                Aperturar Fondo
              </CxpButton>
            </div>
          }
        />

        {/* Notificaciones */}
        {errorMsg && (
          <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
              <X size={16} />
            </button>
          </div>
        )}

        {successMsg && (
          <div role="status" className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Tarjetas de Métricas Generales (Paleta estándar CXP) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Fondos Activos</span>
              <Wallet size={18} className="text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{fondos.length}</div>
            <div className="mt-1 text-xs text-slate-500">
              Total asignado: Q{totalAsignado.toFixed(2)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Saldo Disponible Total</span>
              <Coins size={18} className="text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-700">
              Q{totalDisponible.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Efectivo disponible en cajas chicas
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Gasto Neto (Mes Actual)</span>
              <Scale size={18} className="text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              Q{totalGastoNetoMesActual.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Gastos menos reintegros del mes ({mesActualClave})
            </div>
          </div>
        </div>

        {/* Barra informativa del flujo de captura de comprobantes */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          <div>
            <span className="font-semibold">¿Necesitas registrar un nuevo gasto de caja chica?</span>
            <p className="text-xs text-blue-700 mt-0.5">
              Usa el asistente oficial de comprobantes en Documentos seleccionando el tipo <strong>Gasto de caja chica</strong> para asociar el fondo automáticamente.
            </p>
          </div>
          <Link
            to="/cxp/documentos"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-white border border-blue-300 rounded-lg shadow-sm hover:bg-blue-50 shrink-0"
          >
            Ir a Documentos <ArrowRight size={14} />
          </Link>
        </div>

        {/* Contenedor Principal con Pestañas */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Navegación por Pestañas */}
          <div className="flex border-b border-slate-200 px-6 pt-3 gap-6 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setBandeja('fondos')}
              className={`caja-chica-tab-btn ${bandeja === 'fondos' ? 'caja-chica-tab-active' : 'caja-chica-tab-inactive'}`}
            >
              Fondos de Caja Chica ({fondos.length})
            </button>
            <button
              type="button"
              onClick={() => setBandeja('gastos')}
              className={`caja-chica-tab-btn ${bandeja === 'gastos' ? 'caja-chica-tab-active' : 'caja-chica-tab-inactive'}`}
            >
              Historial de Gastos ({gastos.length})
            </button>
            <button
              type="button"
              onClick={() => setBandeja('reposiciones')}
              className={`caja-chica-tab-btn ${bandeja === 'reposiciones' ? 'caja-chica-tab-active' : 'caja-chica-tab-inactive'}`}
            >
              Reposiciones y Reembolsos ({reposiciones.length})
            </button>
          </div>

          <div className="p-6">
            {/* PESTAÑA 1: FONDOS CON DETALLE DE MOVIMIENTOS */}
            {bandeja === 'fondos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Estructura de Fondos Autorizados</h3>
                    <p className="text-xs text-slate-500">Consulta los saldos disponibles y haz clic en "Ver movimientos" para auditar cada caja chica.</p>
                  </div>
                </div>

                {fondos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <Wallet size={36} className="mb-2 stroke-1 text-slate-300" />
                    <p className="text-sm font-medium">No hay fondos de caja chica registrados</p>
                    <p className="text-xs text-slate-500 mt-1">Haz clic en "Aperturar Fondo" para asignar un fondo fijo.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Referencia / Código</th>
                          <th className="px-4 py-3">Descripción</th>
                          <th className="px-4 py-3 text-right">Monto Autorizado</th>
                          <th className="px-4 py-3 text-right">Saldo Disponible</th>
                          <th className="px-4 py-3 text-right">
                            <span>Gasto Neto (Mes Actual)</span>
                            <span className="block text-[10px] font-normal text-slate-400 lowercase">gastos - reintegros</span>
                          </th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          <th className="px-4 py-3 text-center">Movimientos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {fondos.map(f => {
                          const fId = Number(f.idCompromiso);
                          const gFondo = gastos.filter(g => Number(g.idCompromiso) === fId);
                          const gFondoMes = gFondo.filter(g => (g.fechaDocumento ?? '').startsWith(mesActualClave));
                          const sumGastosFondoMes = gFondoMes.reduce((acc, g) => acc + (Number(g.totalNeto) || 0), 0);

                          const rFondo = reposiciones.filter(
                            r => Number(r.idCompromiso) === fId || gFondo.some(g => Number(r.idDocumentoRelacionado) === Number(g.idDocumento))
                          );
                          const rFondoMes = rFondo.filter(
                            r => (r.fechaDocumento ?? '').startsWith(mesActualClave) && r.estado === 'PAGADA'
                          );
                          const sumReintegrosFondoMes = rFondoMes.reduce((acc, r) => acc + (Number(r.totalNeto) || 0), 0);

                          const gastoNetoFondoMes = Math.max(0, sumGastosFondoMes - sumReintegrosFondoMes);
                          const totalMovimientos = gFondo.length + rFondo.length;

                          return (
                            <tr key={f.idCompromiso} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {f.numeroReferencia || `Fondo #${f.idCompromiso}`}
                              </td>
                              <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={f.descripcion}>
                                {f.descripcion}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-900">
                                Q{Number(f.montoTotal).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-700">
                                Q{Number(f.saldoCapital).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className={`font-semibold ${gastoNetoFondoMes > 0 ? 'text-amber-700 font-bold' : 'text-slate-700'}`}>
                                  Q{gastoNetoFondoMes.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {sumReintegrosFondoMes > 0 ? `(-Q${sumReintegrosFondoMes.toFixed(2)} repuestos)` : 'Sin reintegros'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  f.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {f.estado}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <CxpButton
                                  size="sm"
                                  variant="secondary"
                                  icon={Eye}
                                  onClick={() => setFondoDetalle(f)}
                                >
                                  Ver movimientos ({totalMovimientos})
                                </CxpButton>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA 2: HISTORIAL DE GASTOS */}
            {bandeja === 'gastos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Gastos Registrados (CXP_DOCUMENTO)</h3>
                    <p className="text-xs text-slate-500">Comprobantes autorizados y debitados del saldo de cada fondo.</p>
                  </div>
                </div>

                {gastos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <FileText size={36} className="mb-2 stroke-1 text-slate-300" />
                    <p className="text-sm font-medium">No se han registrado gastos de caja chica</p>
                    <p className="text-xs text-slate-500 mt-1">Registra un gasto desde el catálogo de documentos para imputarlo a un fondo.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Doc #</th>
                          <th className="px-4 py-3">Fondo Asoc.</th>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3 text-right">Importe Neto</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          <th className="px-4 py-3 text-center">Acciones</th>
                          <th className="px-4 py-3 text-center">Reposición</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {gastos.map(g => {
                          const tieneRepo = reposiciones.some((r: any) => Number(r.idDocumentoRelacionado) === Number(g.idDocumento));
                          return (
                            <tr key={g.idDocumento} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {g.serie ? `${g.serie}-${g.numeroDocumento}` : `#${g.idDocumento}`}
                              </td>
                              <td className="px-4 py-3 text-slate-600">ID #{g.idCompromiso}</td>
                              <td className="px-4 py-3 text-slate-500">{g.fechaDocumento?.slice(0, 10)}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900">
                                Q{Number(g.totalNeto).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  g.estado === 'PAGADA'
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                                    : g.estado === 'APROBADA'
                                    ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10'
                                    : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                                }`}>
                                  {g.estado}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Link
                                  to={`/cxp/documentos/${g.idDocumento}`}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                                >
                                  <ExternalLink size={12} /> Ver expediente
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {tieneRepo ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                    <CheckCircle2 size={13} /> Repuesto
                                  </span>
                                ) : g.estado === 'APROBADA' ? (
                                  <button
                                    onClick={() => handleAbrirModalRepo(g)}
                                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                                  >
                                    + Reponer Gasto
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400" title="Debe aprobarse antes de reponerse">
                                    Requiere aprobación
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA 3: REPOSICIONES Y REEMBOLSOS */}
            {bandeja === 'reposiciones' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Reposiciones y Reembolsos (RF-13)</h3>
                    <p className="text-xs text-slate-500">Comprobantes de crédito emitidos para restituir el efectivo a los fondos.</p>
                  </div>
                </div>

                {reposiciones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <RefreshCw size={36} className="mb-2 stroke-1 text-slate-300" />
                    <p className="text-sm font-medium">No hay reposiciones registradas</p>
                    <p className="text-xs text-slate-500 mt-1">Repón un gasto aprobado desde la pestaña de Historial para generar su reembolso.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Doc Reposición</th>
                          <th className="px-4 py-3">Fondo Afectado</th>
                          <th className="px-4 py-3">Gasto Reintegrado</th>
                          <th className="px-4 py-3 text-right">Monto Reintegrado</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          <th className="px-4 py-3 text-center">Expediente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {reposiciones.map(r => (
                          <tr key={r.idDocumento} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {r.serie ? `${r.serie}-${r.numeroDocumento}` : `#${r.idDocumento}`}
                            </td>
                            <td className="px-4 py-3 text-slate-600">ID #{r.idCompromiso}</td>
                            <td className="px-4 py-3 text-slate-600">
                              Gasto #{ (r as any).idDocumentoRelacionado || 'N/A' }
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700">
                              +Q{Number(r.totalNeto).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                {r.estado}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Link
                                to={`/cxp/documentos/${r.idDocumento}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                              >
                                <ExternalLink size={12} /> Ver expediente
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* MODAL: APERTURA DE FONDO */}
        {modalFondoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Aperturar Fondo de Caja Chica</h2>
                <button onClick={() => setModalFondoOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Crea una asignación en CXP_COMPROMISO con saldo disponible inicial para gastos operativos.
              </p>
              
              <form onSubmit={handleCrearFondo} className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Referencia de Fondo *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFondoRef(generarSiguienteReferenciaFondo(fondos))}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      title="Generar nuevo código correlativo automáticamente"
                    >
                      <RefreshCw size={11} /> Regenerar código
                    </button>
                  </div>
                  
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <input
                      type="text"
                      required
                      value={fondoRef}
                      onChange={e => setFondoRef(e.target.value)}
                      placeholder="FONDO-CC-2026-001"
                      className={`w-full rounded-lg border px-3 py-2 text-sm font-mono font-medium focus:outline-none transition-colors ${
                        esRefRepetida
                          ? 'border-red-400 bg-red-50/50 text-red-900 focus:border-red-600'
                          : 'border-slate-300 bg-slate-50/50 text-slate-800 focus:border-blue-600'
                      }`}
                    />
                  </div>

                  {esRefRepetida ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600 animate-in fade-in">
                      <AlertCircle size={13} className="shrink-0" />
                      Esta referencia ya existe. Haz clic en "Regenerar código" para obtener un correlativo único.
                    </p>
                  ) : (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 size={12} /> Nomenclatura institucional (FONDO-CC-YYYY-NNN)
                      </span>
                      <span>Sin duplicidad</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">Descripción / Custodio *</label>
                    <span className="text-[10px] text-slate-400">Sugerencias rápidas</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Custodia administrativa - Gastos de cafetería"
                    value={fondoDesc}
                    onChange={e => setFondoDesc(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[
                      'Custodia Administrativa - Operaciones',
                      'Gastos Menores y Suministros',
                      'Caja Chica - Administración General',
                    ].map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setFondoDesc(sug)}
                        className="rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200 transition-colors"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Monto Autorizado (Q) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="0.01"
                    value={fondoMonto}
                    onChange={e => setFondoMonto(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">El saldo inicial será exactamente igual a este importe.</p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <CxpButton type="button" variant="ghost" onClick={() => setModalFondoOpen(false)}>
                    Cancelar
                  </CxpButton>
                  <CxpButton
                    type="submit"
                    variant="primary"
                    disabled={esRefRepetida || !fondoRef.trim() || !fondoDesc.trim() || !fondoMonto}
                  >
                    Guardar Fondo
                  </CxpButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: GENERAR REPOSICIÓN DE GASTO */}
        {modalRepoOpen && repoGastoSeleccionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Generar Reposición de Gasto</h2>
                <button onClick={() => setModalRepoOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Genera el documento de reembolso para restituir el saldo gastado al Fondo #{repoGastoSeleccionado.idCompromiso}.
              </p>
              
              <form onSubmit={handleCrearReposicion} className="mt-4 space-y-4">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Gasto a reponer:</span>
                    <span className="font-bold text-slate-900">
                      {repoGastoSeleccionado.serie}-{repoGastoSeleccionado.numeroDocumento}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Monto a restituir:</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      Q{Number(repoGastoSeleccionado.totalNeto).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Fondo asignado:</span>
                    <span className="text-slate-800">ID #{repoGastoSeleccionado.idCompromiso}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Serie Reposición</label>
                    <input
                      type="text"
                      value={repoSerie}
                      onChange={e => setRepoSerie(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Número Correlativo</label>
                    <input
                      type="text"
                      required
                      value={repoNumero}
                      onChange={e => setRepoNumero(e.target.value)}
                      placeholder="Ej. REP-001"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <CxpButton type="button" variant="ghost" onClick={() => setModalRepoOpen(false)}>
                    Cancelar
                  </CxpButton>
                  <CxpButton type="submit" variant="primary">
                    Confirmar Reposición
                  </CxpButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL / AUDITORÍA: DETALLE DE MOVIMIENTOS POR FONDO Y T CONTABLE */}
        {fondoDetalle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
              
              {/* Encabezado del modal con botón de exportación rápida a PDF */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Scale size={18} className="text-blue-600" />
                    <span>Auditoría de Movimientos: {fondoDetalle.numeroReferencia || `Fondo #${fondoDetalle.idCompromiso}`}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{fondoDetalle.descripcion}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CxpButton
                    variant="primary"
                    icon={Printer}
                    onClick={handleExportarTContablePDF}
                  >
                    Exportar T Contable (PDF)
                  </CxpButton>
                  <button onClick={() => setFondoDetalle(null)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Barra de Filtros por Período Mensual (RF-11 / Auditoría) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 my-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <Calendar size={14} className="text-slate-500" />
                      <span>Rango de Período:</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={filtroFechaDesde}
                        onChange={e => setFiltroFechaDesde(e.target.value)}
                        className="h-8 rounded-lg border border-slate-300 px-2.5 text-xs bg-white focus:border-blue-600 focus:outline-none"
                      />
                      <span className="text-xs text-slate-400 font-medium">al</span>
                      <input
                        type="date"
                        value={filtroFechaHasta}
                        onChange={e => setFiltroFechaHasta(e.target.value)}
                        className="h-8 rounded-lg border border-slate-300 px-2.5 text-xs bg-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroFechaDesde(primerDiaMesActual);
                        setFiltroFechaHasta(hoyIso);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                    >
                      Mes actual
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(hoyIso);
                        d.setMonth(d.getMonth() - 1);
                        const mesAnt = d.toISOString().slice(0, 7);
                        setFiltroFechaDesde(`${mesAnt}-01`);
                        setFiltroFechaHasta(`${mesAnt}-28`);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 rounded-md border border-slate-300 transition-colors"
                    >
                      Mes anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroFechaDesde('2026-01-01');
                        setFiltroFechaHasta(hoyIso);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 rounded-md border border-slate-300 transition-colors"
                    >
                      Todo el historial
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumen financiero del fondo en el período seleccionado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Monto Autorizado</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    Q{Number(fondoDetalle.montoTotal).toFixed(2)}
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase">Disponible Hoy</span>
                  <p className="text-sm font-bold text-emerald-800 mt-0.5">
                    Q{Number(fondoDetalle.saldoCapital).toFixed(2)}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-red-700 uppercase">Egresos Período</span>
                  <p className="text-sm font-bold text-red-800 mt-0.5">
                    -Q{totalGastosFiltrados.toFixed(2)}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-blue-700 uppercase">Reintegros Período</span>
                  <p className="text-sm font-bold text-blue-800 mt-0.5">
                    +Q{totalReintegrosFiltrados.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Lista combinada de movimientos (Gastos y Reintegros) */}
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg min-h-[220px]">
                <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200 flex justify-between items-center">
                  <span>Movimientos Registrados ({movimientosFiltrados.length})</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Egresos ejecutados y reintegros recibidos
                  </span>
                </div>

                {movimientosFiltrados.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No hay movimientos registrados en el período seleccionado ({filtroFechaDesde} al {filtroFechaHasta}).
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Comprobante</th>
                        <th className="px-3 py-2">Concepto / Detalle</th>
                        <th className="px-3 py-2 text-right">Monto</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                        <th className="px-3 py-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movimientosFiltrados.map(m => (
                        <tr key={`${m.tipo}-${m.id}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2.5">
                            {m.tipo === 'GASTO' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                                <ArrowDownLeft size={10} /> EGRESO
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                <ArrowUpRight size={10} /> REINTEGRO
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">
                            {m.fecha?.slice(0, 10)}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">
                            {m.comprobante}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[240px] truncate" title={m.descripcion}>
                            {m.descripcion}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-bold font-mono ${m.tipo === 'GASTO' ? 'text-red-700' : 'text-emerald-700'}`}>
                            {m.tipo === 'GASTO' ? `-Q${m.monto.toFixed(2)}` : `+Q${m.monto.toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              m.estado === 'PAGADA' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {m.estado}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Link
                              to={`/cxp/documentos/${m.id}`}
                              className="text-blue-700 hover:underline font-semibold"
                            >
                              Ver
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pie del modal con diagnóstico de cuadre y acciones */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1">
                    <CheckCircle2 size={13} /> Arqueo Cuadrado
                  </span>
                  <span className="text-slate-500">
                    Fondo (Q{Number(fondoDetalle.montoTotal).toFixed(2)}) - Egresos (Q{totalGastosFiltrados.toFixed(2)}) + Reintegros (Q{totalReintegrosFiltrados.toFixed(2)})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <CxpButton
                    variant="primary"
                    icon={Printer}
                    onClick={handleExportarTContablePDF}
                  >
                    Exportar T Contable (PDF)
                  </CxpButton>
                  <CxpButton variant="secondary" onClick={() => setFondoDetalle(null)}>
                    Cerrar
                  </CxpButton>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </CxpLayout>
  );
}
