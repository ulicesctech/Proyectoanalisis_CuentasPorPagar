import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import type { CxpAntiguedadReporte, CxpEstadisticaReporte, CxpRetencionesReporte } from '@erp/contracts';
import { Button, TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { CxpBreadcrumb } from '../components/CxpBreadcrumb';
import { errorDe, formatoFecha, formatoMonto } from '../facturas-especiales/api';
import {
  RANGOS, RANGO_COLOR, RANGO_ETIQUETA, antiguedadApi, estadisticaApi, formatoLocal, hoyGuatemala, inicioDeAnio,
  retencionesApi, serieColor,
} from './api';
import { TendenciaMensual } from './components/ReporteComponentes';

/** Cada bloque carga por separado: un reporte con error no oculta a los demás. */
type Estado<T> = { datos: T | null; error: string | null; cargando: boolean };
const inicial = { datos: null, error: null, cargando: true };
const MESES_TENDENCIA = 6;

const proveedorTexto = (id: number | null, nombre: string | null) => nombre ?? (id == null ? 'Sin proveedor' : `Proveedor #${id}`);

function Bloque<T>({ titulo, descripcion, enlace, estado, children }: {
  titulo: string; descripcion: string; enlace: string; estado: Estado<T>; children: (datos: T) => ReactNode;
}) {
  return <section aria-labelledby={`bloque-${enlace}`} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div><h2 id={`bloque-${enlace}`} className="text-lg font-bold text-slate-900">{titulo}</h2>
        <p className="text-sm text-slate-600">{descripcion}</p></div>
      <Link to={`/cxp/reportes/${enlace}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Ver reporte<ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
    {estado.cargando ? <p className="text-sm text-slate-500 py-8 text-center">Consultando…</p>
      : estado.error ? <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{estado.error}</p>
      : estado.datos ? children(estado.datos) : null}
  </section>;
}

function Cifra({ etiqueta, valor, nota, tono = 'neutro' }: { etiqueta: string; valor: string; nota?: string; tono?: 'neutro' | 'alerta' | 'bien' }) {
  const color = tono === 'alerta' ? 'text-red-700' : tono === 'bien' ? 'text-emerald-700' : 'text-slate-900';
  return <div>
    <p className="text-sm font-medium text-slate-600">{etiqueta}</p>
    <p className={`text-xl xl:text-2xl font-bold tabular-nums whitespace-nowrap ${color}`}>{valor}</p>
    {nota && <p className="text-sm text-slate-600">{nota}</p>}
  </div>;
}

export function CxpReportesResumenPage() {
  const [periodo, setPeriodo] = useState({ fechaInicio: inicioDeAnio(), fechaFin: hoyGuatemala() });
  const [consultado, setConsultado] = useState(periodo);
  const [antiguedad, setAntiguedad] = useState<Estado<CxpAntiguedadReporte>>(inicial);
  const [estadistica, setEstadistica] = useState<Estado<CxpEstadisticaReporte>>(inicial);
  const [retenciones, setRetenciones] = useState<Estado<CxpRetencionesReporte>>(inicial);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback((fechas: { fechaInicio: string; fechaFin: string }) => {
    setConsultado(fechas);
    const seguir = <T,>(promesa: Promise<T>, guardar: (estado: Estado<T>) => void) => {
      guardar({ datos: null, error: null, cargando: true });
      promesa.then(datos => guardar({ datos, error: null, cargando: false }))
        .catch(reason => guardar({ datos: null, error: errorDe(reason).mensaje, cargando: false }));
    };
    // La antigüedad se corta al final del período para que las tres vistas hablen de la misma fecha.
    seguir(antiguedadApi.consultar({ fechaCorte: fechas.fechaFin }), setAntiguedad);
    seguir(estadisticaApi.consultar(fechas), setEstadistica);
    seguir(retencionesApi.consultar(fechas), setRetenciones);
  }, []);

  useEffect(() => { cargar({ fechaInicio: inicioDeAnio(), fechaFin: hoyGuatemala() }); }, [cargar]);

  const enviar = (event: React.FormEvent) => {
    event.preventDefault();
    if (!periodo.fechaInicio || !periodo.fechaFin) { setError('Indica el período a consultar.'); return; }
    if (periodo.fechaInicio > periodo.fechaFin) { setError('La fecha inicial no puede ser posterior a la final.'); return; }
    if (periodo.fechaFin > hoyGuatemala()) { setError('La fecha final no puede ser posterior a hoy.'); return; }
    setError(null);
    cargar(periodo);
  };
  const ocupado = antiguedad.cargando || estadistica.cargando || retenciones.cargando;

  return <CxpLayout screen="reportes">
    <div className="space-y-5">
      <div><CxpBreadcrumb group="Reportes" current="Resumen" />
        <h1 className="text-2xl font-bold text-slate-900">Resumen de cuentas por pagar</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">Deuda con proveedores al {formatoFecha(consultado.fechaFin)}, compras y retenciones del {formatoFecha(consultado.fechaInicio)} al {formatoFecha(consultado.fechaFin)}. Cada bloque abre su reporte con el detalle y la exportación.</p></div>

      <form onSubmit={enviar} className="bg-white border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-[minmax(8.5rem,11rem)_minmax(8.5rem,11rem)_auto] sm:items-end sm:justify-start">
        <TextInput id="res-inicio" type="date" label="Desde" required value={periodo.fechaInicio}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPeriodo({ ...periodo, fechaInicio: event.target.value })} />
        <TextInput id="res-fin" type="date" label="Hasta (fecha de corte)" required value={periodo.fechaFin} max={hoyGuatemala()}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPeriodo({ ...periodo, fechaFin: event.target.value })} />
        <Button type="submit" icon={RefreshCw} disabled={ocupado}>{ocupado ? 'Consultando…' : 'Actualizar'}</Button>
      </form>
      {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</p>}

      <Bloque titulo="Antigüedad de saldos" descripcion={`Deuda pendiente al ${formatoFecha(consultado.fechaFin)}.`} enlace="antiguedad" estado={antiguedad}>
        {datos => !datos.resumenPorMoneda.length ? <p className="text-sm text-slate-600">No hay saldos pendientes a esa fecha.</p>
          : <div className="space-y-5">{datos.resumenPorMoneda.map(resumen => {
            const rangos = datos.resumenPorRango.filter(item => item.moneda === resumen.moneda);
            const top = datos.rankingProveedores.filter(item => item.moneda === resumen.moneda).slice(0, 3);
            return <div key={resumen.moneda} className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
              <div className="space-y-4">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-4">
                  <Cifra etiqueta="Deuda total" valor={formatoMonto(resumen.saldoTotal, resumen.moneda)} nota={`${resumen.cantidadDocumentos} documentos`} />
                  <Cifra etiqueta="Vencida" valor={formatoMonto(resumen.saldoVencido, resumen.moneda)} tono={resumen.saldoVencido > 0 ? 'alerta' : 'neutro'}
                    nota={`${resumen.saldoTotal > 0 ? Math.round((resumen.saldoVencido / resumen.saldoTotal) * 1000) / 10 : 0} % de la deuda`} />
                  <Cifra etiqueta="Por vencer" valor={formatoMonto(resumen.saldoNoVencido, resumen.moneda)} tono="bien" />
                </div>
                <div>
                  <div className="flex h-3 rounded-full bg-slate-100 overflow-hidden" role="img"
                    aria-label={rangos.map(item => `${RANGO_ETIQUETA[item.rango]}: ${formatoMonto(item.saldo, resumen.moneda)}`).join(', ')}>
                    {RANGOS.map(rango => {
                      const saldo = rangos.find(item => item.rango === rango)?.saldo ?? 0;
                      return saldo > 0 ? <span key={rango} className={`h-full ${RANGO_COLOR[rango]}`} style={{ width: `${(saldo / resumen.saldoTotal) * 100}%` }} /> : null;
                    })}
                  </div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-700">
                    {rangos.map(item => <li key={item.rango} className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${RANGO_COLOR[item.rango]}`} aria-hidden="true" />{RANGO_ETIQUETA[item.rango]}</li>)}
                  </ul>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Mayor deuda</h3>
                <ol className="space-y-2">
                  {top.map(item => <li key={item.idProveedor} className="flex justify-between gap-3 text-sm">
                    <span className="truncate"><span className="text-slate-500 tabular-nums mr-2">{item.posicion}.</span>{proveedorTexto(item.idProveedor, item.nombreProveedor)}</span>
                    <span className="tabular-nums font-semibold whitespace-nowrap">{formatoMonto(item.saldoTotal, item.moneda)}</span>
                  </li>)}
                </ol>
              </div>
            </div>;
          })}</div>}
      </Bloque>

      <div className="grid gap-5 xl:grid-cols-2">
        <Bloque titulo="Estadística de compras" descripcion="Compras aprobadas del período, en moneda local." enlace="estadistica" estado={estadistica}>
          {datos => {
            const total = datos.resumen.porMes.reduce((suma, mes) => suma + mes.totalLocal, 0);
            const variacion = datos.resumen.variacionTotal;
            const meses = datos.resumen.porMes.slice(-MESES_TENDENCIA);
            const principal = datos.resumen.porProveedor[0];
            return !datos.resumen.porMes.length ? <p className="text-sm text-slate-600">No hay compras en el período.</p>
              : <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <Cifra etiqueta="Compras" valor={formatoLocal(total)} nota={`${datos.totales.cantidadDocumentos} documentos`} />
                  <Cifra etiqueta="Contra el período anterior" valor={variacion === null ? '—' : `${variacion > 0 ? '+' : ''}${variacion} %`}
                    nota={variacion === null ? 'Sin compras para comparar' : `Antes: ${formatoLocal(datos.periodoComparable.totalLocal)}`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Últimos meses</h3>
                  <TendenciaMensual periodos={meses.map(mes => mes.periodo)} series={[{ clave: 'compras', etiqueta: 'Compras' }]} moneda=""
                    valor={periodoMes => meses.find(mes => mes.periodo === periodoMes)?.totalLocal ?? 0} />
                </div>
                {principal && <p className="text-sm text-slate-700">Proveedor principal: <span className="font-semibold">{proveedorTexto(principal.idProveedor, principal.nombreProveedor)}</span>, {principal.participacion} % de las compras.</p>}
              </div>;
          }}
        </Bloque>

        <Bloque titulo="Retenciones de IVA e ISR" descripcion="Retenciones aplicadas en el período." enlace="retenciones" estado={retenciones}>
          {datos => {
            const monedas = [...new Set(datos.resumenPorMes.map(item => item.moneda))].sort();
            return !datos.detalle.length ? <p className="text-sm text-slate-600">No hay retenciones en el período.</p>
              : <div className="space-y-5">{monedas.map(moneda => {
                const meses = datos.resumenPorMes.filter(item => item.moneda === moneda);
                const tributos = [...new Map(meses.map(item => [item.codigoTributo, item.nombreTributo])).entries()].sort(([a], [b]) => a.localeCompare(b));
                const total = meses.reduce((suma, item) => suma + item.monto, 0);
                const proveedores = datos.resumenPorProveedor.filter(item => item.moneda === moneda);
                const cantidad = proveedores.reduce((suma, item) => suma + item.cantidad, 0);
                const pendientes = cantidad - proveedores.reduce((suma, item) => suma + item.conConstancia, 0);
                return <div key={moneda} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Cifra etiqueta={monedas.length > 1 ? `Total retenido · ${moneda}` : 'Total retenido'} valor={formatoMonto(total, moneda)} nota={`${cantidad} retenciones`} />
                    <Cifra etiqueta="Sin constancia" valor={String(pendientes)} tono={pendientes > 0 ? 'alerta' : 'bien'}
                      nota={pendientes > 0 ? 'Retenciones sin número de constancia' : 'Todas tienen constancia'} />
                  </div>
                  <ul className="space-y-2">
                    {tributos.map(([codigo, nombre], indice) => {
                      const monto = meses.filter(item => item.codigoTributo === codigo).reduce((suma, item) => suma + item.monto, 0);
                      return <li key={codigo}>
                        <span className="flex justify-between gap-3 text-sm">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                            <span className={`h-2.5 w-2.5 rounded-full ${serieColor(indice)}`} aria-hidden="true" />{nombre}<span className="text-slate-500 font-normal">· {codigo}</span></span>
                          <span className="tabular-nums font-semibold">{formatoMonto(monto, moneda)}</span>
                        </span>
                        <span className="block h-2 mt-1 rounded-full bg-slate-100 overflow-hidden">
                          <span className={`block h-full rounded-full ${serieColor(indice)}`} style={{ width: `${total > 0 ? (monto / total) * 100 : 0}%` }} /></span>
                      </li>;
                    })}
                  </ul>
                </div>;
              })}</div>;
          }}
        </Bloque>
      </div>
    </div>
  </CxpLayout>;
}
