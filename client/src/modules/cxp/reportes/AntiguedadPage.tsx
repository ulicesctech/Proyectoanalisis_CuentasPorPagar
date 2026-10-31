import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import type { CxpAntiguedadFiltros, CxpAntiguedadReporte, CxpRangoAntiguedad } from '@erp/contracts';
import { Button, Select, TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { RelationSelect } from '../components/RelationSelect';
import { errorDe, formatoFecha, formatoMonto } from '../facturas-especiales/api';
import {
  FORMATO_ID, FORMATO_MONEDA, RANGOS, RANGO_COLOR, RANGO_ETIQUETA, antiguedadApi, filtroUrl, hoyGuatemala, leerPeriodo,
  parametrosReporte,
} from './api';
import { AtajosCorte, PanelFiltros, SelectorMoneda, useNombresProveedor, type ChipFiltro } from './components/FiltrosReporte';
import { BotonesExportar } from './components/ReporteComponentes';
import { ReportesEncabezado } from './components/ReportesEncabezado';

type Formulario = { fechaCorte: string; idProveedor: string; moneda: string; rango: string };
const SIN_FILTROS = { idProveedor: '', moneda: '', rango: '' };

/** Filtros desde la URL: "hasta" es la fecha de corte; un valor inválido se ignora. */
function leerFormulario(params: URLSearchParams): Formulario {
  const rango = params.get('rango') ?? '';
  return {
    fechaCorte: leerPeriodo(params).fechaFin,
    idProveedor: filtroUrl(params, 'proveedor', FORMATO_ID),
    moneda: filtroUrl(params, 'moneda', FORMATO_MONEDA),
    rango: (RANGOS as string[]).includes(rango) ? rango : '',
  };
}

const aFiltros = (formulario: Formulario): CxpAntiguedadFiltros => ({
  fechaCorte: formulario.fechaCorte,
  idProveedor: formulario.idProveedor ? Number(formulario.idProveedor) : undefined,
  moneda: formulario.moneda.trim().toUpperCase() || undefined,
  rangoAntiguedad: (formulario.rango || undefined) as CxpRangoAntiguedad | undefined,
});
const clave = (formulario: Formulario) => JSON.stringify(aFiltros(formulario));
const errorCorte = (fecha: string) => !fecha ? 'Indica la fecha de corte.' : fecha > hoyGuatemala() ? 'No puede ser posterior a hoy.' : null;

const RANKING_VISIBLE = 10;
const POR_PAGINA = 20;

/** Selección hecha sobre el resultado (rango o proveedor); no vuelve a consultar Oracle. */
type Foco = { moneda: string; rango?: CxpRangoAntiguedad; idProveedor?: number; etiqueta: string };

const proveedorTexto = (id: number, nombre: string | null) => nombre ?? `Proveedor #${id}`;
const porcentaje = (parte: number, total: number) => total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;

export function CxpAntiguedadPage() {
  // El período compartido de reportes llega en la URL; aquí "hasta" es la fecha de corte.
  const [params, setParams] = useSearchParams();
  // setParams cambia de identidad con cada URL: se usa por referencia para no repetir la consulta inicial.
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;
  const busquedaUrl = params.toString();
  const periodo = useMemo(() => leerPeriodo(new URLSearchParams(busquedaUrl)), [busquedaUrl]);
  const [inicial] = useState(() => leerFormulario(new URLSearchParams(busquedaUrl)));
  const [formulario, setFormulario] = useState<Formulario>(inicial);
  const [aplicado, setAplicado] = useState<Formulario | null>(null);
  const [validar, setValidar] = useState(false);
  const [reporte, setReporte] = useState<CxpAntiguedadReporte | null>(null);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foco, setFoco] = useState<Foco | null>(null);
  const [pagina, setPagina] = useState(1);
  const [nombres, recordarNombre] = useNombresProveedor();
  const proveedorActual = useRef(formulario.idProveedor);
  proveedorActual.current = formulario.idProveedor;
  const alResolverNombre = useCallback((nombre: string) => recordarNombre(proveedorActual.current, nombre), [recordarNombre]);
  const aplicados = aplicado ? aFiltros(aplicado) : null;

  const consultar = useCallback((siguiente: Formulario) => {
    setCargando(true);
    setError(null);
    const filtros = aFiltros(siguiente);
    antiguedadApi.consultar(filtros)
      .then(resultado => {
        setReporte(resultado); setAplicado(siguiente); setFoco(null); setPagina(1);
        setParamsRef.current(previos => {
          const actual = leerPeriodo(previos);
          return parametrosReporte(
            { fechaInicio: actual.fechaInicio <= filtros.fechaCorte ? actual.fechaInicio : filtros.fechaCorte, fechaFin: filtros.fechaCorte },
            { proveedor: siguiente.idProveedor, moneda: filtros.moneda, rango: siguiente.rango });
        }, { replace: true });
      })
      .catch(reason => setError(errorDe(reason).mensaje))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { consultar(inicial); }, [consultar, inicial]);

  /** Aplica el formulario indicado; si la fecha no es válida, muestra el error junto al campo. */
  const aplicar = (siguiente: Formulario) => {
    setFormulario(siguiente);
    setValidar(true);
    if (errorCorte(siguiente.fechaCorte)) return;
    consultar(siguiente);
  };
  /** Quita filtros ya aplicados sin perder otros cambios del formulario que aún no se aplican. */
  const quitar = (campos: Partial<Formulario>) => {
    if (!aplicado) return;
    setFormulario(actual => ({ ...actual, ...campos }));
    consultar({ ...aplicado, ...campos });
  };

  // Primero el nombre que devuelve el reporte; la etiqueta del selector incluye id y NIT.
  const nombreProveedor = (id: string) => reporte?.rankingProveedores.find(item => String(item.idProveedor) === id)?.nombreProveedor
    ?? nombres[id] ?? `Proveedor #${id}`;
  const chips: ChipFiltro[] = !aplicado ? [] : [
    aplicado.idProveedor && { clave: 'proveedor', etiqueta: 'Proveedor', valor: nombreProveedor(aplicado.idProveedor), onQuitar: () => quitar({ idProveedor: '' }) },
    aplicado.moneda && { clave: 'moneda', etiqueta: 'Moneda', valor: aplicado.moneda, onQuitar: () => quitar({ moneda: '' }) },
    aplicado.rango && { clave: 'rango', etiqueta: 'Rango', valor: RANGO_ETIQUETA[aplicado.rango as CxpRangoAntiguedad], onQuitar: () => quitar({ rango: '' }) },
  ].filter((chip): chip is ChipFiltro => Boolean(chip));
  const pendientes = aplicado !== null && clave(formulario) !== clave(aplicado);
  const errorFecha = validar ? errorCorte(formulario.fechaCorte) : null;

  const exportar = (formato: 'excel' | 'pdf') => {
    if (!aplicados) return;
    setExportando(formato);
    setError(null);
    antiguedadApi.exportar(aplicados, formato)
      .catch(reason => setError(errorDe(reason).mensaje))
      .finally(() => setExportando(null));
  };

  const elegir = (siguiente: Foco) => {
    setFoco(actual => actual && actual.moneda === siguiente.moneda && actual.rango === siguiente.rango
      && actual.idProveedor === siguiente.idProveedor ? null : siguiente);
    setPagina(1);
  };

  const facturas = useMemo(() => (reporte?.detalle ?? []).filter(row => !foco || (
    (row.moneda ?? 'SIN MONEDA') === foco.moneda
    && (!foco.rango || row.rangoAntiguedad === foco.rango)
    && (foco.idProveedor === undefined || row.idProveedor === foco.idProveedor))), [reporte, foco]);
  const paginas = Math.max(1, Math.ceil(facturas.length / POR_PAGINA));
  const visibles = facturas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const variasMonedas = (reporte?.resumenPorMoneda.length ?? 0) > 1;

  return <CxpLayout screen="reportes/antiguedad">
    <div className="space-y-5 max-w-[1600px]">
      <ReportesEncabezado actual="antiguedad" periodo={periodo}
        descripcion="Saldos pendientes a la fecha de corte; solo descuentan los pagos aplicados hasta ese día.">
        <BotonesExportar disponible={!!reporte} exportando={exportando} onExportar={exportar} />
      </ReportesEncabezado>

      <PanelFiltros cargando={cargando} pendientes={pendientes} chips={chips} errorValidacion={errorFecha}
        onSubmit={() => aplicar(formulario)} onLimpiar={() => quitar(SIN_FILTROS)}
        atajos={<AtajosCorte fecha={formulario.fechaCorte} cargando={cargando} onElegir={fecha => aplicar({ ...formulario, fechaCorte: fecha })} />}>
        <div className="lg:col-span-3">
          <TextInput id="ant-corte" type="date" label="Fecha de corte" required value={formulario.fechaCorte} max={hoyGuatemala()}
            error={errorFecha ?? undefined} aria-invalid={errorFecha ? true : undefined}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, fechaCorte: event.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          <RelationSelect id="ant-proveedor" catalog="proveedores" label="Proveedor" placeholder="Todos los proveedores" allowCreate={false}
            value={formulario.idProveedor} onLabelChange={alResolverNombre}
            onChange={(value, etiqueta) => { setFormulario({ ...formulario, idProveedor: value }); recordarNombre(value, etiqueta); }} />
        </div>
        <SelectorMoneda id="ant-moneda" value={formulario.moneda} onChange={moneda => setFormulario({ ...formulario, moneda })} />
        <div className="lg:col-span-2">
          <Select id="ant-rango" label="Rango" value={formulario.rango} placeholder=""
            options={[{ value: '', label: 'Todos los rangos' }, ...RANGOS.map(rango => ({ value: rango, label: RANGO_ETIQUETA[rango] }))]}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormulario({ ...formulario, rango: event.target.value })} />
        </div>
      </PanelFiltros>

      {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</p>}

      {reporte && !reporte.detalle.length && !cargando &&
        <p className="bg-white border border-slate-200 rounded-xl px-6 py-10 text-center text-slate-600">
          No hay saldos pendientes al {formatoFecha(reporte.fechaCorte)} con estos filtros.</p>}

      {reporte && reporte.resumenPorMoneda.map(resumen => {
        const rangos = reporte.resumenPorRango.filter(item => item.moneda === resumen.moneda);
        const ranking = reporte.rankingProveedores.filter(item => item.moneda === resumen.moneda).slice(0, RANKING_VISIBLE);
        const mayorRango = Math.max(...rangos.map(item => item.saldo), 0);
        return <section key={resumen.moneda} aria-labelledby={`ant-${resumen.moneda}`} className="space-y-4">
          {variasMonedas && <h2 id={`ant-${resumen.moneda}`} className="text-lg font-bold text-slate-900">Saldos en {resumen.moneda}</h2>}
          {!variasMonedas && <h2 id={`ant-${resumen.moneda}`} className="sr-only">Resumen al corte</h2>}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <p className="text-sm font-medium text-slate-600">Deuda total al {formatoFecha(reporte.fechaCorte)}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{formatoMonto(resumen.saldoTotal, resumen.moneda)}</p>
              <p className="text-sm text-slate-600 mt-1">{resumen.cantidadDocumentos} {resumen.cantidadDocumentos === 1 ? 'documento' : 'documentos'}</p>
            </div>
            {resumen.saldoVencido > 0
              ? <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <p className="text-sm font-medium text-red-800">Deuda vencida</p>
                <p className="text-3xl font-bold text-red-700 mt-1 tabular-nums">{formatoMonto(resumen.saldoVencido, resumen.moneda)}</p>
                <p className="text-sm text-red-800 mt-1">{porcentaje(resumen.saldoVencido, resumen.saldoTotal)} % de la deuda</p>
              </div>
              : <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm font-medium text-slate-600">Deuda vencida</p>
                <p className="text-3xl font-bold text-emerald-700 mt-1 tabular-nums">{formatoMonto(0, resumen.moneda)}</p>
                <p className="text-sm text-emerald-800 mt-1">Sin saldos vencidos a la fecha de corte</p>
              </div>}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <p className="text-sm font-medium text-emerald-800">Por vencer o sin vencimiento</p>
              <p className="text-3xl font-bold text-emerald-700 mt-1 tabular-nums">{formatoMonto(resumen.saldoNoVencido, resumen.moneda)}</p>
              <p className="text-sm text-emerald-800 mt-1">{porcentaje(resumen.saldoNoVencido, resumen.saldoTotal)} % de la deuda</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-bold text-slate-900">Rangos de vencimiento</h3>
              <p className="text-sm text-slate-600 mb-4">Días transcurridos desde el vencimiento. Elige un rango para ver sus facturas.</p>
              <ul className="space-y-1">
                {rangos.map(item => {
                  const activo = foco?.moneda === resumen.moneda && foco.rango === item.rango;
                  return <li key={item.rango}>
                    <button type="button" aria-pressed={activo}
                      onClick={() => elegir({ moneda: resumen.moneda, rango: item.rango, etiqueta: RANGO_ETIQUETA[item.rango] })}
                      className={`w-full text-left rounded-lg px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activo ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <span className="flex justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-800">{RANGO_ETIQUETA[item.rango]}</span>
                        <span className="tabular-nums text-slate-900 font-semibold">{formatoMonto(item.saldo, resumen.moneda)}</span>
                      </span>
                      <span className="flex items-center gap-3 mt-1.5">
                        <span className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <span className={`block h-full rounded-full ${RANGO_COLOR[item.rango]}`}
                            style={{ width: `${mayorRango > 0 ? Math.max(2, (item.saldo / mayorRango) * 100) : 0}%` }} />
                        </span>
                        <span className="text-xs text-slate-600 w-24 text-right">{item.cantidadDocumentos} doc. · {porcentaje(item.saldo, resumen.saldoTotal)} %</span>
                      </span>
                    </button>
                  </li>;
                })}
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5 pb-3">
                <h3 className="font-bold text-slate-900">Proveedores con mayor deuda</h3>
                <p className="text-sm text-slate-600">{ranking.length < reporte.rankingProveedores.filter(item => item.moneda === resumen.moneda).length
                  ? `Los ${RANKING_VISIBLE} primeros de ${reporte.rankingProveedores.filter(item => item.moneda === resumen.moneda).length}.` : 'Ordenados por saldo al corte.'} Elige uno para ver sus facturas.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-2.5 w-10">#</th><th className="px-4 py-2.5">Proveedor</th>
                    <th className="px-4 py-2.5 text-right">Saldo</th><th className="px-4 py-2.5 text-right">Vencido</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Días máx.</th><th className="px-4 py-2.5 min-w-32">Participación</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {ranking.map(item => {
                      const activo = foco?.moneda === resumen.moneda && foco.idProveedor === item.idProveedor;
                      return <tr key={item.idProveedor} className={activo ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-2.5 text-slate-600 tabular-nums">{item.posicion}</td>
                        <td className="px-4 py-2.5">
                          <button type="button" aria-pressed={activo} className="text-left font-medium text-blue-700 hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                            onClick={() => elegir({ moneda: resumen.moneda, idProveedor: item.idProveedor, etiqueta: proveedorTexto(item.idProveedor, item.nombreProveedor) })}>
                            {proveedorTexto(item.idProveedor, item.nombreProveedor)}</button>
                          <span className="block text-xs text-slate-600">{item.cantidadDocumentos} {item.cantidadDocumentos === 1 ? 'documento' : 'documentos'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">{formatoMonto(item.saldoTotal, item.moneda)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${item.saldoVencido > 0 ? 'text-red-700' : 'text-slate-600'}`}>{formatoMonto(item.saldoVencido, item.moneda)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{item.diasMaximos}</td>
                        <td className="px-4 py-2.5"><span className="flex items-center gap-2">
                          <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full bg-blue-600 rounded-full" style={{ width: `${item.participacion}%` }} /></span>
                          <span className="text-xs tabular-nums w-12 text-right">{item.participacion} %</span></span></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>;
      })}

      {reporte && reporte.detalle.length > 0 && <section aria-labelledby="ant-detalle" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="ant-detalle" className="font-bold text-slate-900">Detalle por factura</h2>
            <p className="text-sm text-slate-600">{facturas.length} {facturas.length === 1 ? 'documento' : 'documentos'}, de mayor a menor antigüedad.</p></div>
          {foco && <button type="button" onClick={() => { setFoco(null); setPagina(1); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-800 px-3 py-1.5 text-sm font-medium hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {foco.etiqueta}{variasMonedas ? ` · ${foco.moneda}` : ''}<X size={14} aria-label="Quitar selección" /></button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-slate-50 text-xs font-semibold text-slate-600">
              {['Documento', 'Proveedor', 'Emisión', 'Vencimiento', 'Rango', 'Total', 'Saldo al corte'].map(titulo =>
                <th key={titulo} className={`px-4 py-2.5 whitespace-nowrap ${['Total', 'Saldo al corte'].includes(titulo) ? 'text-right' : ''}`}>{titulo}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map(row => <tr key={row.idDocumento} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 whitespace-nowrap"><Link to={`/cxp/documentos/${row.idDocumento}`} className="font-medium text-blue-700 hover:underline underline-offset-2">
                  {row.numeroDocumento ?? `#${row.idDocumento}`}</Link>
                  <span className="block text-xs text-slate-600">{row.tipoDocumento ?? '—'}</span></td>
                <td className="px-4 py-2.5 min-w-40">{proveedorTexto(row.idProveedor, row.nombreProveedor)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{formatoFecha(row.fechaDocumento)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{formatoFecha(row.fechaVencimiento)}
                  {row.diasAntiguedad > 0 && <span className="block text-xs text-red-700">{row.diasAntiguedad} días vencida</span>}</td>
                <td className="px-4 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${RANGO_COLOR[row.rangoAntiguedad as CxpRangoAntiguedad] ?? 'bg-slate-400'}`} aria-hidden="true" />
                  {RANGO_ETIQUETA[row.rangoAntiguedad as CxpRangoAntiguedad] ?? row.rangoAntiguedad}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{formatoMonto(row.totalNeto, row.moneda ?? '')}</td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold">{formatoMonto(row.saldoHistorico, row.moneda ?? '')}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {paginas > 1 && <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 text-sm">
          <span className="text-slate-600">Página {pagina} de {paginas}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
          </div>
        </div>}
      </section>}
    </div>
  </CxpLayout>;
}
