import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import type { CxpRetencionesFiltros, CxpRetencionesReporte } from '@erp/contracts';
import { TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { RelationSelect } from '../components/RelationSelect';
import { errorDe, formatoFecha, formatoMonto } from '../facturas-especiales/api';
import {
  FORMATO_ID, FORMATO_MONEDA, filtroUrl, formatoTexto, retencionesApi, serieColor, type FormatoExportacion, leerPeriodo,
  parametrosReporte,
} from './api';
import { ReportesEncabezado } from './components/ReportesEncabezado';
import { BotonesExportar, Paginacion, TendenciaMensual } from './components/ReporteComponentes';
import {
  AtajosPeriodo, CamposPeriodo, PanelFiltros, SelectorMoneda, erroresPeriodo, useNombresProveedor, type ChipFiltro,
} from './components/FiltrosReporte';

type Formulario = {
  fechaInicio: string; fechaFin: string; idProveedor: string; codigoTributo: string; moneda: string; numeroConstancia: string;
};
const SIN_FILTROS = { idProveedor: '', codigoTributo: '', moneda: '', numeroConstancia: '' };

function leerFormulario(params: URLSearchParams): Formulario {
  return {
    ...leerPeriodo(params),
    idProveedor: filtroUrl(params, 'proveedor', FORMATO_ID),
    codigoTributo: filtroUrl(params, 'tributo', formatoTexto(30)),
    moneda: filtroUrl(params, 'moneda', FORMATO_MONEDA),
    numeroConstancia: filtroUrl(params, 'constancia', formatoTexto(50)),
  };
}

const aFiltros = (formulario: Formulario): CxpRetencionesFiltros => ({
  fechaInicio: formulario.fechaInicio, fechaFin: formulario.fechaFin,
  idProveedor: formulario.idProveedor ? Number(formulario.idProveedor) : undefined,
  codigoTributo: formulario.codigoTributo.trim() || undefined,
  moneda: formulario.moneda.trim().toUpperCase() || undefined,
  numeroConstancia: formulario.numeroConstancia.trim() || undefined,
});
const clave = (formulario: Formulario) => JSON.stringify(aFiltros(formulario));

const POR_PAGINA = 20;
const SIN_MONEDA = 'SIN MONEDA';
const SIN_CODIGO = 'SIN_CODIGO';

/** Selección sobre el resultado (proveedor o tributo); no vuelve a consultar Oracle. */
type Foco = { moneda: string; idProveedor?: number | null; codigoTributo?: string; etiqueta: string };

const proveedorTexto = (id: number | null, nombre: string | null) => nombre ?? (id == null ? 'Sin proveedor' : `Proveedor #${id}`);

export function CxpRetencionesPage() {
  // Período compartido de reportes (?desde=&hasta=); se actualiza al consultar.
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
  const [reporte, setReporte] = useState<CxpRetencionesReporte | null>(null);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState<FormatoExportacion | null>(null);
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
    retencionesApi.consultar(filtros)
      .then(resultado => {
        setReporte(resultado); setAplicado(siguiente); setFoco(null); setPagina(1);
        setParamsRef.current(parametrosReporte({ fechaInicio: filtros.fechaInicio, fechaFin: filtros.fechaFin }, {
          proveedor: siguiente.idProveedor, tributo: filtros.codigoTributo, moneda: filtros.moneda, constancia: filtros.numeroConstancia,
        }), { replace: true });
      })
      .catch(reason => setError(errorDe(reason).mensaje))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { consultar(inicial); }, [consultar, inicial]);

  const aplicar = (siguiente: Formulario) => {
    setFormulario(siguiente);
    setValidar(true);
    const errores = erroresPeriodo(siguiente);
    if (errores.desde || errores.hasta) return;
    consultar(siguiente);
  };
  const quitar = (campos: Partial<Formulario>) => {
    if (!aplicado) return;
    setFormulario(actual => ({ ...actual, ...campos }));
    consultar({ ...aplicado, ...campos });
  };

  // Primero el nombre que devuelve el reporte; la etiqueta del selector incluye id y NIT.
  const nombreProveedor = (id: string) => reporte?.resumenPorProveedor.find(item => String(item.idProveedor) === id)?.nombreProveedor
    ?? nombres[id] ?? `Proveedor #${id}`;
  const chips: ChipFiltro[] = !aplicado ? [] : [
    aplicado.idProveedor && { clave: 'proveedor', etiqueta: 'Proveedor', valor: nombreProveedor(aplicado.idProveedor), onQuitar: () => quitar({ idProveedor: '' }) },
    aplicado.moneda && { clave: 'moneda', etiqueta: 'Moneda', valor: aplicado.moneda, onQuitar: () => quitar({ moneda: '' }) },
    aplicado.codigoTributo.trim() && { clave: 'tributo', etiqueta: 'Tributo', valor: aplicado.codigoTributo.trim(), onQuitar: () => quitar({ codigoTributo: '' }) },
    aplicado.numeroConstancia.trim() && { clave: 'constancia', etiqueta: 'Constancia', valor: aplicado.numeroConstancia.trim(), onQuitar: () => quitar({ numeroConstancia: '' }) },
  ].filter((chip): chip is ChipFiltro => Boolean(chip));
  const pendientes = aplicado !== null && clave(formulario) !== clave(aplicado);
  const erroresFecha = validar ? erroresPeriodo(formulario) : { desde: null, hasta: null };

  const exportar = (formato: FormatoExportacion) => {
    if (!aplicados) return;
    setExportando(formato);
    setError(null);
    retencionesApi.exportar(aplicados, formato)
      .catch(reason => setError(errorDe(reason).mensaje))
      .finally(() => setExportando(null));
  };

  const elegir = (siguiente: Foco) => {
    setFoco(actual => actual && actual.moneda === siguiente.moneda && actual.idProveedor === siguiente.idProveedor
      && actual.codigoTributo === siguiente.codigoTributo ? null : siguiente);
    setPagina(1);
  };

  // Monedas presentes y, para cada una, sus tributos en orden de código.
  const monedas = useMemo(() => {
    const porMoneda = new Map<string, Map<string, string>>();
    for (const mes of reporte?.resumenPorMes ?? []) {
      const tributos = porMoneda.get(mes.moneda) ?? new Map<string, string>();
      tributos.set(mes.codigoTributo, mes.nombreTributo);
      porMoneda.set(mes.moneda, tributos);
    }
    return [...porMoneda.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([moneda, tributos]) => ({
      moneda,
      tributos: [...tributos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([clave, etiqueta]) => ({ clave, etiqueta })),
    }));
  }, [reporte]);
  const variasMonedas = monedas.length > 1;

  const retenciones = useMemo(() => (reporte?.detalle ?? []).filter(row => !foco || (
    (row.moneda ?? SIN_MONEDA) === foco.moneda
    && (foco.idProveedor === undefined || row.idProveedor === foco.idProveedor)
    && (!foco.codigoTributo || (row.codigoTributo ?? SIN_CODIGO) === foco.codigoTributo))), [reporte, foco]);
  const paginas = Math.max(1, Math.ceil(retenciones.length / POR_PAGINA));
  const visibles = retenciones.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return <CxpLayout screen="reportes/retenciones">
    <div className="space-y-5 max-w-[1600px]">
      <ReportesEncabezado actual="retenciones" periodo={periodo}
        descripcion="Retenciones aplicadas en el período, según las reglas tributarias. No incluye las anuladas.">
        <BotonesExportar disponible={!!reporte} exportando={exportando} onExportar={exportar} />
      </ReportesEncabezado>

      <PanelFiltros cargando={cargando} pendientes={pendientes} chips={chips}
        errorValidacion={erroresFecha.desde ?? erroresFecha.hasta}
        onSubmit={() => aplicar(formulario)} onLimpiar={() => quitar(SIN_FILTROS)}
        atajos={<AtajosPeriodo periodo={formulario} cargando={cargando} onElegir={elegido => aplicar({ ...formulario, ...elegido })} />}>
        <CamposPeriodo prefijo="ret" periodo={formulario} mostrarErrores={validar}
          onCambiar={cambio => setFormulario({ ...formulario, ...cambio })} />
        <div className="sm:col-span-2 lg:col-span-4">
          <RelationSelect id="ret-proveedor" catalog="proveedores" label="Proveedor" placeholder="Todos los proveedores" allowCreate={false}
            value={formulario.idProveedor} onLabelChange={alResolverNombre}
            onChange={(value, etiqueta) => { setFormulario({ ...formulario, idProveedor: value }); recordarNombre(value, etiqueta); }} />
        </div>
        <SelectorMoneda id="ret-moneda" value={formulario.moneda} onChange={moneda => setFormulario({ ...formulario, moneda })} />
        <div className="lg:col-span-2">
          <TextInput id="ret-tributo" label="Código de tributo" placeholder="Todos" maxLength={30} value={formulario.codigoTributo}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, codigoTributo: event.target.value })} />
        </div>
        <div className="lg:col-span-3">
          <TextInput id="ret-constancia" label="Número de constancia" placeholder="Cualquiera" maxLength={50} value={formulario.numeroConstancia}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, numeroConstancia: event.target.value })} />
        </div>
      </PanelFiltros>

      {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</p>}

      {reporte && !reporte.detalle.length && !cargando &&
        <p className="bg-white border border-slate-200 rounded-xl px-6 py-10 text-center text-slate-600">
          No hay retenciones aplicadas entre el {formatoFecha(reporte.fechaInicio)} y el {formatoFecha(reporte.fechaFin)} con estos filtros.</p>}

      {reporte && monedas.map(({ moneda, tributos }) => {
        const meses = reporte.resumenPorMes.filter(item => item.moneda === moneda);
        const periodos = [...new Set(meses.map(item => item.periodo))];
        const totalTributo = (clave: string) => meses.filter(item => item.codigoTributo === clave).reduce((total, item) => total + item.monto, 0);
        const cantidadTributo = (clave: string) => meses.filter(item => item.codigoTributo === clave).reduce((total, item) => total + item.cantidad, 0);
        const total = tributos.reduce((suma, tributo) => suma + totalTributo(tributo.clave), 0);
        const proveedores = reporte.resumenPorProveedor.filter(item => item.moneda === moneda);
        const conConstancia = proveedores.reduce((suma, item) => suma + item.conConstancia, 0);
        const cantidad = proveedores.reduce((suma, item) => suma + item.cantidad, 0);
        return <section key={moneda} aria-labelledby={`ret-${moneda}`} className="space-y-4">
          <h2 id={`ret-${moneda}`} className={variasMonedas ? 'text-lg font-bold text-slate-900' : 'sr-only'}>Retenciones en {moneda}</h2>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-medium text-slate-600">Total retenido</p>
              <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{formatoMonto(total, moneda)}</p>
              <p className="text-sm text-slate-600 mt-1">{cantidad} {cantidad === 1 ? 'retención' : 'retenciones'}</p>
            </div>
            {tributos.map((tributo, indice) => {
              const activo = foco?.moneda === moneda && foco.codigoTributo === tributo.clave;
              return <button key={tributo.clave} type="button" aria-pressed={activo}
                onClick={() => elegir({ moneda, codigoTributo: tributo.clave, etiqueta: tributo.etiqueta })}
                className={`text-left rounded-xl p-5 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activo ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <span className={`h-2.5 w-2.5 rounded-full ${serieColor(indice)}`} aria-hidden="true" />{tributo.etiqueta}
                  <span className="text-slate-500">· {tributo.clave}</span></span>
                <span className="block text-2xl font-bold text-slate-900 mt-1 tabular-nums">{formatoMonto(totalTributo(tributo.clave), moneda)}</span>
                <span className="block text-sm text-slate-600 mt-1">{cantidadTributo(tributo.clave)} {cantidadTributo(tributo.clave) === 1 ? 'retención' : 'retenciones'}</span>
              </button>;
            })}
            <div className={`rounded-xl p-5 border ${conConstancia < cantidad ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className={`text-sm font-medium ${conConstancia < cantidad ? 'text-amber-900' : 'text-emerald-800'}`}>Constancias emitidas</p>
              <p className={`text-3xl font-bold mt-1 tabular-nums ${conConstancia < cantidad ? 'text-amber-800' : 'text-emerald-700'}`}>{conConstancia} de {cantidad}</p>
              <p className={`text-sm mt-1 ${conConstancia < cantidad ? 'text-amber-900' : 'text-emerald-800'}`}>
                {conConstancia < cantidad ? `${cantidad - conConstancia} sin número de constancia` : 'Todas tienen número de constancia'}</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-bold text-slate-900">Tendencia mensual</h3>
              <p className="text-sm text-slate-600 mb-4">Monto retenido por mes de aplicación.</p>
              <TendenciaMensual periodos={periodos} series={tributos} moneda={moneda}
                valor={(periodo, clave) => meses.find(item => item.periodo === periodo && item.codigoTributo === clave)?.monto ?? 0} />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5 pb-3">
                <h3 className="font-bold text-slate-900">Retenciones por proveedor</h3>
                <p className="text-sm text-slate-600">Ordenados por monto retenido. Elige uno para ver sus retenciones.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-2.5">Proveedor</th>
                    {tributos.map(tributo => <th key={tributo.clave} className="px-4 py-2.5 text-right whitespace-nowrap">{tributo.etiqueta}</th>)}
                    <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Constancias</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {proveedores.map(item => {
                      const activo = foco?.moneda === moneda && foco.idProveedor === item.idProveedor && !foco.codigoTributo;
                      return <tr key={item.idProveedor ?? 'sin'} className={activo ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-2.5">
                          <button type="button" aria-pressed={activo} className="text-left font-medium text-blue-700 hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                            onClick={() => elegir({ moneda, idProveedor: item.idProveedor, etiqueta: proveedorTexto(item.idProveedor, item.nombreProveedor) })}>
                            {proveedorTexto(item.idProveedor, item.nombreProveedor)}</button>
                          <span className="block text-xs text-slate-600">Base {formatoMonto(item.baseImponible, moneda)}</span>
                        </td>
                        {tributos.map(tributo => <td key={tributo.clave} className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {formatoMonto(item.porTributo.find(parte => parte.codigoTributo === tributo.clave)?.monto ?? 0, moneda)}</td>)}
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">{formatoMonto(item.monto, moneda)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${item.conConstancia < item.cantidad ? 'text-amber-800' : 'text-slate-700'}`}>{item.conConstancia} de {item.cantidad}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>;
      })}

      {reporte && reporte.detalle.length > 0 && <section aria-labelledby="ret-detalle" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="ret-detalle" className="font-bold text-slate-900">Detalle de retenciones</h2>
            <p className="text-sm text-slate-600">{retenciones.length} {retenciones.length === 1 ? 'retención' : 'retenciones'}, por fecha de aplicación.</p></div>
          {foco && <button type="button" onClick={() => { setFoco(null); setPagina(1); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-800 px-3 py-1.5 text-sm font-medium hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {foco.etiqueta}{variasMonedas ? ` · ${foco.moneda}` : ''}<X size={14} aria-label="Quitar selección" /></button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-slate-50 text-xs font-semibold text-slate-600">
              {['Aplicación', 'Documento', 'Proveedor', 'Tributo', 'Base', '%', 'Retenido', 'Constancia'].map(titulo =>
                <th key={titulo} className={`px-4 py-2.5 whitespace-nowrap ${['Base', '%', 'Retenido'].includes(titulo) ? 'text-right' : ''}`}>{titulo}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map(row => <tr key={row.idTributo} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 whitespace-nowrap">{formatoFecha(row.fechaAplicacion)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap"><Link to={`/cxp/documentos/${row.idDocumento}`} className="font-medium text-blue-700 hover:underline underline-offset-2">
                  {row.numeroDocumento ?? `#${row.idDocumento}`}</Link>
                  <span className="block text-xs text-slate-600">{row.tipoDocumento ?? '—'}</span></td>
                <td className="px-4 py-2.5 min-w-40">{proveedorTexto(row.idProveedor, row.nombreProveedor)}</td>
                <td className="px-4 py-2.5 min-w-32">{row.nombreTributo ?? '—'}<span className="block text-xs text-slate-600">{row.codigoTributo ?? '—'}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{formatoMonto(row.baseImponible, row.moneda ?? '')}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.porcentaje}</td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold">{formatoMonto(row.monto, row.moneda ?? '')}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{row.numeroConstancia ?? <span className="text-amber-800">Pendiente</span>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <Paginacion pagina={pagina} paginas={paginas} onCambiar={setPagina} />
      </section>}
    </div>
  </CxpLayout>;
}
