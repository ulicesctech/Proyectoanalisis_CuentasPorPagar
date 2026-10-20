import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { CxpRetencionesFiltros, CxpRetencionesReporte } from '@erp/contracts';
import { Button, TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { CxpBreadcrumb } from '../components/CxpBreadcrumb';
import { RelationSelect } from '../components/RelationSelect';
import { errorDe, formatoFecha, formatoMonto } from '../facturas-especiales/api';
import { hoyGuatemala, inicioDeAnio, retencionesApi, serieColor, type FormatoExportacion } from './api';
import { BotonesExportar, Paginacion, TendenciaMensual } from './components/ReporteComponentes';

const POR_PAGINA = 20;
const SIN_MONEDA = 'SIN MONEDA';
const SIN_CODIGO = 'SIN_CODIGO';

/** Selección sobre el resultado (proveedor o tributo); no vuelve a consultar Oracle. */
type Foco = { moneda: string; idProveedor?: number | null; codigoTributo?: string; etiqueta: string };

const proveedorTexto = (id: number | null, nombre: string | null) => nombre ?? (id == null ? 'Sin proveedor' : `Proveedor #${id}`);

export function CxpRetencionesPage() {
  const [formulario, setFormulario] = useState({
    fechaInicio: inicioDeAnio(), fechaFin: hoyGuatemala(), idProveedor: '', codigoTributo: '', moneda: '', numeroConstancia: '',
  });
  const [aplicados, setAplicados] = useState<CxpRetencionesFiltros | null>(null);
  const [reporte, setReporte] = useState<CxpRetencionesReporte | null>(null);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState<FormatoExportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foco, setFoco] = useState<Foco | null>(null);
  const [pagina, setPagina] = useState(1);

  const consultar = useCallback((filtros: CxpRetencionesFiltros) => {
    setCargando(true);
    setError(null);
    retencionesApi.consultar(filtros)
      .then(resultado => { setReporte(resultado); setAplicados(filtros); setFoco(null); setPagina(1); })
      .catch(reason => setError(errorDe(reason).mensaje))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { consultar({ fechaInicio: inicioDeAnio(), fechaFin: hoyGuatemala() }); }, [consultar]);

  const enviar = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formulario.fechaInicio || !formulario.fechaFin) { setError('Indica el período a consultar.'); return; }
    if (formulario.fechaInicio > formulario.fechaFin) { setError('La fecha inicial no puede ser posterior a la final.'); return; }
    consultar({
      fechaInicio: formulario.fechaInicio, fechaFin: formulario.fechaFin,
      idProveedor: formulario.idProveedor ? Number(formulario.idProveedor) : undefined,
      codigoTributo: formulario.codigoTributo.trim() || undefined,
      moneda: formulario.moneda.trim().toUpperCase() || undefined,
      numeroConstancia: formulario.numeroConstancia.trim() || undefined,
    });
  };

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
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div><CxpBreadcrumb group="Reportes" current="Retenciones" />
          <h1 className="text-2xl font-bold text-slate-900">Retenciones de IVA e ISR</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">Retenciones aplicadas a proveedores en el período, según la fecha de aplicación. Los tributos y porcentajes provienen de las reglas tributarias; las retenciones anuladas no se incluyen.</p></div>
        <BotonesExportar disponible={!!reporte} exportando={exportando} onExportar={exportar} />
      </div>

      <form onSubmit={enviar} className="bg-white border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_minmax(14rem,1fr)_9rem_6rem] xl:grid-cols-[10rem_10rem_minmax(14rem,1fr)_9rem_6rem_10rem_auto] lg:items-end">
        <TextInput id="ret-inicio" type="date" label="Desde" required value={formulario.fechaInicio}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, fechaInicio: event.target.value })} />
        <TextInput id="ret-fin" type="date" label="Hasta" required value={formulario.fechaFin}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, fechaFin: event.target.value })} />
        <RelationSelect id="ret-proveedor" catalog="proveedores" label="Proveedor" placeholder="Todos los proveedores" allowCreate={false}
          value={formulario.idProveedor} onChange={value => setFormulario({ ...formulario, idProveedor: value })} />
        <TextInput id="ret-tributo" label="Código de tributo" placeholder="Todos" maxLength={30} value={formulario.codigoTributo}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, codigoTributo: event.target.value })} />
        <TextInput id="ret-moneda" label="Moneda" placeholder="Todas" maxLength={3} value={formulario.moneda}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, moneda: event.target.value.toUpperCase() })} />
        <TextInput id="ret-constancia" label="Constancia" placeholder="Número" maxLength={50} value={formulario.numeroConstancia}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, numeroConstancia: event.target.value })} />
        <Button type="submit" icon={Search} disabled={cargando}>{cargando ? 'Consultando…' : 'Consultar'}</Button>
      </form>

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
