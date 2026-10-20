import { useCallback, useEffect, useState } from 'react';
import { Search, TrendingDown, TrendingUp } from 'lucide-react';
import type { CxpEstadisticaFiltros, CxpEstadisticaReporte } from '@erp/contracts';
import { Button, TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { CxpBreadcrumb } from '../components/CxpBreadcrumb';
import { RelationSelect } from '../components/RelationSelect';
import { errorDe, formatoFecha } from '../facturas-especiales/api';
import { estadisticaApi, formatoLocal, hoyGuatemala, inicioDeAnio, serieColor, type FormatoExportacion } from './api';
import { BotonesExportar, TendenciaMensual } from './components/ReporteComponentes';

const PROVEEDORES_VISIBLES = 10;
const SERIE_COMPRAS = [{ clave: 'compras', etiqueta: 'Compras' }];

/** "FACTURA_CAMBIARIA" → "Factura cambiaria". */
const tipoTexto = (tipo: string) => tipo === 'SIN_TIPO' ? 'Sin tipo' : tipo.charAt(0) + tipo.slice(1).toLowerCase().replace(/_/g, ' ');
const proveedorTexto = (id: number | null, nombre: string | null) => nombre ?? (id == null ? 'Sin proveedor' : `Proveedor #${id}`);

export function CxpEstadisticaPage() {
  const [formulario, setFormulario] = useState({ fechaInicio: inicioDeAnio(), fechaFin: hoyGuatemala(), idProveedor: '', moneda: '', centroCosto: '' });
  const [aplicados, setAplicados] = useState<CxpEstadisticaFiltros | null>(null);
  const [reporte, setReporte] = useState<CxpEstadisticaReporte | null>(null);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState<FormatoExportacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback((filtros: CxpEstadisticaFiltros) => {
    setCargando(true);
    setError(null);
    estadisticaApi.consultar(filtros)
      .then(resultado => { setReporte(resultado); setAplicados(filtros); })
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
      moneda: formulario.moneda.trim().toUpperCase() || undefined,
      centroCosto: formulario.centroCosto.trim() || undefined,
    });
  };

  const exportar = (formato: FormatoExportacion) => {
    if (!aplicados) return;
    setExportando(formato);
    setError(null);
    estadisticaApi.exportar(aplicados, formato)
      .catch(reason => setError(errorDe(reason).mensaje))
      .finally(() => setExportando(null));
  };

  const resumen = reporte?.resumen;
  const total = resumen?.porMes.reduce((suma, mes) => suma + mes.totalLocal, 0) ?? 0;
  const principal = resumen?.porProveedor[0];
  const variacion = resumen?.variacionTotal ?? null;
  const advertencias = (reporte?.validacion.advertencias ?? [])
    .filter(texto => !texto.startsWith('No se encontraron documentos') && !texto.startsWith('No existe información suficiente'));

  return <CxpLayout screen="reportes/estadistica">
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div><CxpBreadcrumb group="Reportes" current="Estadística de compras" />
          <h1 className="text-2xl font-bold text-slate-900">Estadística de compras</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">Compras aprobadas por fecha del documento, en moneda local (total neto por tipo de cambio). No incluye borradores, documentos anulados ni caja chica.</p></div>
        <BotonesExportar disponible={!!reporte} exportando={exportando} onExportar={exportar} />
      </div>

      <form onSubmit={enviar} className="bg-white border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(8.5rem,10rem)_minmax(8.5rem,10rem)_minmax(10rem,1fr)_minmax(4.5rem,6rem)_minmax(7rem,10rem)_auto] lg:items-end">
        <TextInput id="est-inicio" type="date" label="Desde" required value={formulario.fechaInicio}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, fechaInicio: event.target.value })} />
        <TextInput id="est-fin" type="date" label="Hasta" required value={formulario.fechaFin}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, fechaFin: event.target.value })} />
        <RelationSelect id="est-proveedor" catalog="proveedores" label="Proveedor" placeholder="Todos los proveedores" allowCreate={false}
          value={formulario.idProveedor} onChange={value => setFormulario({ ...formulario, idProveedor: value })} />
        <TextInput id="est-moneda" label="Moneda" placeholder="Todas" maxLength={3} value={formulario.moneda}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, moneda: event.target.value.toUpperCase() })} />
        <TextInput id="est-centro" label="Centro de costo" placeholder="Todos" maxLength={30} value={formulario.centroCosto}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, centroCosto: event.target.value })} />
        <Button type="submit" icon={Search} disabled={cargando}>{cargando ? 'Consultando…' : 'Consultar'}</Button>
      </form>

      {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</p>}
      {advertencias.map(texto => <p key={texto} role="status" className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg p-3">{texto}</p>)}

      {reporte && resumen && !resumen.porMes.length && !cargando &&
        <p className="bg-white border border-slate-200 rounded-xl px-6 py-10 text-center text-slate-600">
          No hay compras entre el {formatoFecha(reporte.fechaInicio)} y el {formatoFecha(reporte.fechaFin)} con estos filtros.</p>}

      {reporte && resumen && resumen.porMes.length > 0 && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-600">Compras del período</p>
            <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{formatoLocal(total)}</p>
            <p className="text-sm text-slate-600 mt-1">Moneda local</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-600">Documentos</p>
            <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{reporte.totales.cantidadDocumentos}</p>
            <p className="text-sm text-slate-600 mt-1">{resumen.porProveedor.length} {resumen.porProveedor.length === 1 ? 'proveedor' : 'proveedores'}</p>
          </div>
          <div className={`rounded-xl p-5 border ${variacion === null ? 'bg-white border-slate-200' : variacion > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className="text-sm font-medium text-slate-700">Contra el período anterior</p>
            <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums inline-flex items-center gap-2">
              {variacion === null ? '—' : <>{variacion > 0 ? <TrendingUp size={24} aria-hidden="true" /> : <TrendingDown size={24} aria-hidden="true" />}{variacion > 0 ? '+' : ''}{variacion} %</>}</p>
            <p className="text-sm text-slate-700 mt-1">{variacion === null
              ? `Sin compras del ${formatoFecha(reporte.periodoComparable.fechaInicio)} al ${formatoFecha(reporte.periodoComparable.fechaFin)}`
              : `${formatoLocal(reporte.periodoComparable.totalLocal)} del ${formatoFecha(reporte.periodoComparable.fechaInicio)} al ${formatoFecha(reporte.periodoComparable.fechaFin)}`}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-600">Proveedor principal</p>
            <p className="text-xl font-bold text-slate-900 mt-1 truncate">{principal ? proveedorTexto(principal.idProveedor, principal.nombreProveedor) : '—'}</p>
            <p className="text-sm text-slate-600 mt-1">{principal ? `${principal.participacion} % de las compras` : ''}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-bold text-slate-900">Compras mensuales</h2>
            <p className="text-sm text-slate-600 mb-4">Total por mes de la fecha del documento.</p>
            <TendenciaMensual periodos={resumen.porMes.map(mes => mes.periodo)} series={SERIE_COMPRAS} moneda=""
              valor={periodo => resumen.porMes.find(mes => mes.periodo === periodo)?.totalLocal ?? 0} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-bold text-slate-900">Desglose por tipo de documento</h2>
            <p className="text-sm text-slate-600 mb-4">Participación de cada tipo en el total.</p>
            <ul className="space-y-3">
              {resumen.porTipoDocumento.map((tipo, indice) => <li key={tipo.tipoDocumento}>
                <span className="flex justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">{tipoTexto(tipo.tipoDocumento)}</span>
                  <span className="tabular-nums font-semibold text-slate-900">{formatoLocal(tipo.totalLocal)}</span>
                </span>
                <span className="flex items-center gap-3 mt-1.5">
                  <span className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <span className={`block h-full rounded-full ${serieColor(indice)}`} style={{ width: `${Math.max(1, tipo.participacion)}%` }} /></span>
                  <span className="text-xs text-slate-600 w-28 text-right">{tipo.cantidad} doc. · {tipo.participacion} %</span>
                </span>
              </li>)}
            </ul>
          </div>
        </div>

        <section aria-labelledby="est-proveedores" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 pb-3">
            <h2 id="est-proveedores" className="font-bold text-slate-900">Proveedores principales</h2>
            <p className="text-sm text-slate-600">{resumen.porProveedor.length > PROVEEDORES_VISIBLES
              ? `Los ${PROVEEDORES_VISIBLES} primeros de ${resumen.porProveedor.length}, por monto comprado.` : 'Ordenados por monto comprado.'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-2.5 w-10">#</th><th className="px-4 py-2.5">Proveedor</th>
                <th className="px-4 py-2.5 text-right">Documentos</th><th className="px-4 py-2.5 text-right">Compras</th>
                <th className="px-4 py-2.5 min-w-40">Participación</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {resumen.porProveedor.slice(0, PROVEEDORES_VISIBLES).map(item => <tr key={item.idProveedor ?? 'sin'} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-600 tabular-nums">{item.posicion}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{proveedorTexto(item.idProveedor, item.nombreProveedor)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{item.cantidad}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">{formatoLocal(item.totalLocal)}</td>
                  <td className="px-4 py-2.5"><span className="flex items-center gap-2">
                    <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full bg-blue-600 rounded-full" style={{ width: `${item.participacion}%` }} /></span>
                    <span className="text-xs tabular-nums w-14 text-right">{item.participacion} %</span></span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </>}
    </div>
  </CxpLayout>;
}
