import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarClock, CircleCheck, Files, LoaderCircle, RefreshCw, TriangleAlert, Wallet,
} from 'lucide-react';
import type {
  CxpAntiguedadReporte, CxpEstadisticaReporte, CxpRangoAntiguedad, CxpRetencionesReporte,
} from '@erp/contracts';
import { Button, TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { errorDe, formatoFecha, formatoMonto } from '../facturas-especiales/api';
import {
  antiguedadApi, diasAlertaVencimiento, errorPeriodo, estadisticaApi, etiquetaMes, formatoLocal, hoyGuatemala, leerPeriodo,
  parametrosPeriodo, retencionesApi, serieColor, type Periodo,
} from './api';
import { DetallePendientes, situacionDe } from './components/DetallePendientes';
import { ReportesEncabezado, rutaReporte } from './components/ReportesEncabezado';
import {
  BarraSegmentada, Cifra, FilaDistribucion, GraficoColumnas, Insignia, Panel, PanelCargando, PanelError, PanelVacio,
  TarjetaIndicador, TarjetaIndicadorCargando, type Segmento,
} from './components/Visuales';

/** Cada bloque carga por separado: un reporte con error no oculta a los demás. */
type Estado<T> = { datos: T | null; error: string | null; cargando: boolean };
const CARGANDO = { datos: null, error: null, cargando: true };
const PROVEEDORES_VISIBLES = 5;

/** Rangos del resumen: los vencidos de más de 90 días se agrupan; el reporte conserva el detalle. */
const CATEGORIAS: { clave: string; etiqueta: string; color: string; rangos: CxpRangoAntiguedad[]; vencida: boolean }[] = [
  { clave: 'por-vencer', etiqueta: 'Por vencer', color: 'bg-emerald-500', rangos: ['NO VENCIDO'], vencida: false },
  { clave: 'sin-fecha', etiqueta: 'Sin fecha de vencimiento', color: 'bg-slate-400', rangos: ['SIN VENCIMIENTO'], vencida: false },
  { clave: '1-30', etiqueta: '1 a 30 días', color: 'bg-amber-400', rangos: ['1-30'], vencida: true },
  { clave: '31-60', etiqueta: '31 a 60 días', color: 'bg-orange-500', rangos: ['31-60'], vencida: true },
  { clave: '61-90', etiqueta: '61 a 90 días', color: 'bg-red-500', rangos: ['61-90'], vencida: true },
  { clave: '90+', etiqueta: 'Más de 90 días', color: 'bg-red-800', rangos: ['91-120', 'MAS DE 120'], vencida: true },
];

const proveedorTexto = (id: number | null, nombre: string | null) => nombre ?? (id == null ? 'Sin proveedor' : `Proveedor #${id}`);
const porcentaje = (parte: number, total: number) => total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
const plural = (cantidad: number, singular: string, varios: string) => `${cantidad} ${cantidad === 1 ? singular : varios}`;

export function CxpReportesResumenPage() {
  const [params, setParams] = useSearchParams();
  // Se memoriza por el texto de la URL: el objeto de useSearchParams puede cambiar en cada render.
  const busqueda = params.toString();
  const periodo = useMemo(() => leerPeriodo(new URLSearchParams(busqueda)), [busqueda]);
  const [formulario, setFormulario] = useState<Periodo>(periodo);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [antiguedad, setAntiguedad] = useState<Estado<CxpAntiguedadReporte>>(CARGANDO);
  const [estadistica, setEstadistica] = useState<Estado<CxpEstadisticaReporte>>(CARGANDO);
  const [retenciones, setRetenciones] = useState<Estado<CxpRetencionesReporte>>(CARGANDO);
  const [diasAlerta, setDiasAlerta] = useState<number | null>(null);
  const [monedaElegida, setMonedaElegida] = useState<string | null>(null);

  const seguir = useCallback(<T,>(promesa: () => Promise<T>, guardar: (estado: Estado<T>) => void) => {
    guardar(CARGANDO);
    promesa().then(datos => guardar({ datos, error: null, cargando: false }))
      .catch(reason => guardar({ datos: null, error: errorDe(reason).mensaje, cargando: false }));
  }, []);
  // La antigüedad se corta en "Hasta" para que los tres bloques hablen de la misma fecha.
  const cargarAntiguedad = useCallback(() => seguir(() => antiguedadApi.consultar({ fechaCorte: periodo.fechaFin }), setAntiguedad), [seguir, periodo]);
  const cargarEstadistica = useCallback(() => seguir(() => estadisticaApi.consultar(periodo), setEstadistica), [seguir, periodo]);
  const cargarRetenciones = useCallback(() => seguir(() => retencionesApi.consultar(periodo), setRetenciones), [seguir, periodo]);

  useEffect(() => {
    setFormulario(periodo);
    cargarAntiguedad(); cargarEstadistica(); cargarRetenciones();
  }, [periodo, cargarAntiguedad, cargarEstadistica, cargarRetenciones]);
  useEffect(() => { diasAlertaVencimiento().then(setDiasAlerta).catch(() => setDiasAlerta(null)); }, []);

  const actualizar = (event: React.FormEvent) => {
    event.preventDefault();
    const problema = errorPeriodo(formulario);
    setErrorFormulario(problema);
    if (problema) return;
    if (formulario.fechaInicio === periodo.fechaInicio && formulario.fechaFin === periodo.fechaFin) {
      cargarAntiguedad(); cargarEstadistica(); cargarRetenciones();
    } else setParams(parametrosPeriodo(formulario));
  };
  const ocupado = antiguedad.cargando || estadistica.cargando || retenciones.cargando;

  // Monedas con saldo o retenciones; GTQ primero cuando existe.
  const monedas = useMemo(() => {
    const todas = new Set([...(antiguedad.datos?.resumenPorMoneda.map(item => item.moneda) ?? []),
      ...(retenciones.datos?.resumenPorMes.map(item => item.moneda) ?? [])]);
    return [...todas].sort((a, b) => (a === 'GTQ' ? -1 : b === 'GTQ' ? 1 : a.localeCompare(b)));
  }, [antiguedad.datos, retenciones.datos]);
  const moneda = monedaElegida && monedas.includes(monedaElegida) ? monedaElegida : monedas[0] ?? 'GTQ';

  const deuda = useMemo(() => {
    const datos = antiguedad.datos;
    if (!datos) return null;
    const resumen = datos.resumenPorMoneda.find(item => item.moneda === moneda)
      ?? { moneda, cantidadDocumentos: 0, saldoTotal: 0, saldoVencido: 0, saldoNoVencido: 0 };
    const filas = datos.detalle.filter(row => (row.moneda ?? 'SIN MONEDA') === moneda);
    const situaciones = filas.map(row => situacionDe(row, datos.fechaCorte, diasAlerta).situacion);
    const categorias = CATEGORIAS.map(categoria => {
      const rangos = datos.resumenPorRango.filter(item => item.moneda === moneda && categoria.rangos.includes(item.rango));
      return { ...categoria, saldo: rangos.reduce((suma, item) => suma + item.saldo, 0), documentos: rangos.reduce((suma, item) => suma + item.cantidadDocumentos, 0) };
    }).filter(categoria => categoria.clave !== 'sin-fecha' || categoria.documentos > 0);
    return {
      resumen, categorias,
      vencidos: situaciones.filter(item => item === 'VENCIDA').length,
      proximos: situaciones.filter(item => item === 'PROXIMA').length,
      sinFecha: filas.filter(row => !row.fechaVencimiento).length,
      proveedores: datos.rankingProveedores.filter(item => item.moneda === moneda),
    };
  }, [antiguedad.datos, moneda, diasAlerta]);

  const retenido = useMemo(() => {
    const datos = retenciones.datos;
    if (!datos) return null;
    const meses = datos.resumenPorMes.filter(item => item.moneda === moneda);
    const tributos = [...new Map(meses.map(item => [item.codigoTributo, item.nombreTributo])).entries()]
      .map(([codigo, nombre]) => ({ codigo, nombre, monto: meses.filter(item => item.codigoTributo === codigo).reduce((suma, item) => suma + item.monto, 0),
        cantidad: meses.filter(item => item.codigoTributo === codigo).reduce((suma, item) => suma + item.cantidad, 0) }))
      .sort((a, b) => b.monto - a.monto);
    const filas = datos.detalle.filter(row => (row.moneda ?? 'SIN MONEDA') === moneda);
    return {
      tributos, total: tributos.reduce((suma, item) => suma + item.monto, 0), cantidad: filas.length,
      sinConstancia: filas.filter(row => !row.numeroConstancia).length,
      // Primero las que necesitan constancia, luego las de mayor importe.
      revisar: [...filas].sort((a, b) => Number(!!a.numeroConstancia) - Number(!!b.numeroConstancia) || b.monto - a.monto).slice(0, 5),
    };
  }, [retenciones.datos, moneda]);

  const descripcion = `Deuda con proveedores al ${formatoFecha(periodo.fechaFin)}, compras y retenciones del ${formatoFecha(periodo.fechaInicio)} al ${formatoFecha(periodo.fechaFin)}.`;

  return <CxpLayout screen="reportes">
    <div className="space-y-5 max-w-[1600px]">
      <ReportesEncabezado actual="resumen" descripcion={descripcion} />

      <form onSubmit={actualizar} noValidate aria-label="Período del resumen"
        className="bg-white border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-[minmax(8.5rem,11rem)_minmax(8.5rem,11rem)_auto] sm:items-end sm:justify-start">
        <TextInput id="res-desde" type="date" label="Desde" required value={formulario.fechaInicio} max={formulario.fechaFin || hoyGuatemala()}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, fechaInicio: event.target.value })} />
        <TextInput id="res-hasta" type="date" label="Hasta (fecha de corte)" required value={formulario.fechaFin} max={hoyGuatemala()}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, fechaFin: event.target.value })} />
        <Button type="submit" icon={ocupado ? LoaderCircle : RefreshCw} disabled={ocupado} aria-busy={ocupado}
          className={ocupado ? '[&>svg]:animate-spin' : ''}>{ocupado ? 'Consultando…' : 'Actualizar'}</Button>
      </form>

      {errorFormulario && <PanelError mensaje={errorFormulario} />}

      {monedas.length > 1 && <div role="group" aria-label="Moneda de los indicadores" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-700">Moneda:</span>
        {monedas.map(item => <button key={item} type="button" aria-pressed={item === moneda} onClick={() => setMonedaElegida(item)}
          className={`rounded-full px-3 py-1 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${item === moneda ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{item}</button>)}
      </div>}

      <section aria-label="Indicadores de deuda" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {antiguedad.cargando ? Array.from({ length: 4 }, (_, indice) => <TarjetaIndicadorCargando key={indice} />)
          : antiguedad.error || !deuda ? <div className="sm:col-span-2 xl:col-span-4"><PanelError mensaje={`Deuda: ${antiguedad.error ?? 'sin datos'}`} onReintentar={cargarAntiguedad} /></div>
          : <>
            <TarjetaIndicador icono={Wallet} tono="info" etiqueta="Deuda total" valor={formatoMonto(deuda.resumen.saldoTotal, moneda)}
              descripcion={`Saldo pendiente al ${formatoFecha(periodo.fechaFin)}`} />
            {deuda.resumen.saldoVencido > 0
              ? <TarjetaIndicador icono={TriangleAlert} tono="vencido" estado="Requiere atención" etiqueta="Deuda vencida" valor={formatoMonto(deuda.resumen.saldoVencido, moneda)}
                descripcion={`${porcentaje(deuda.resumen.saldoVencido, deuda.resumen.saldoTotal)} % de la deuda · ${plural(deuda.vencidos, 'documento', 'documentos')}`} />
              : <TarjetaIndicador icono={CircleCheck} tono="positivo" estado="Al día" etiqueta="Deuda vencida" valor={formatoMonto(0, moneda)}
                descripcion="Sin saldos vencidos a la fecha de corte" />}
            <TarjetaIndicador icono={CalendarClock} tono={deuda.proximos > 0 ? 'atencion' : 'neutro'} etiqueta="Deuda por vencer"
              estado={deuda.proximos > 0 ? `${deuda.proximos} próximos` : undefined}
              valor={formatoMonto(deuda.resumen.saldoNoVencido, moneda)}
              descripcion={`${porcentaje(deuda.resumen.saldoNoVencido, deuda.resumen.saldoTotal)} % de la deuda${deuda.sinFecha ? ` · ${deuda.sinFecha} sin fecha de vencimiento` : ''}`} />
            <TarjetaIndicador icono={Files} etiqueta="Documentos pendientes" valor={String(deuda.resumen.cantidadDocumentos)}
              descripcion={`De ${plural(deuda.proveedores.length, 'proveedor', 'proveedores')}, con saldo al corte`} />
          </>}
      </section>

      <Panel titulo="Antigüedad de saldos" descripcion={`Deuda pendiente al ${formatoFecha(periodo.fechaFin)} por días de vencimiento.`}
        enlace={rutaReporte('antiguedad', periodo)}>
        {antiguedad.cargando ? <PanelCargando filas={5} />
          : antiguedad.error ? <PanelError mensaje={antiguedad.error} onReintentar={cargarAntiguedad} />
          : !deuda || !deuda.resumen.cantidadDocumentos ? <PanelVacio>No hay saldos pendientes en {moneda} al {formatoFecha(periodo.fechaFin)}.</PanelVacio>
          : <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Distribución por antigüedad</h3>
              <BarraSegmentada formato={valor => formatoMonto(valor, moneda)}
                segmentos={deuda.categorias.map<Segmento>(categoria => ({ clave: categoria.clave, etiqueta: categoria.etiqueta, valor: categoria.saldo, color: categoria.color,
                  detalle: plural(categoria.documentos, 'documento', 'documentos') }))} />
              <ul className="space-y-3">
                {deuda.categorias.map(categoria => <FilaDistribucion key={categoria.clave} marcador color={categoria.color}
                  etiqueta={categoria.vencida ? <>Vencido · {categoria.etiqueta}</> : categoria.etiqueta}
                  valor={formatoMonto(categoria.saldo, moneda)} porcentaje={porcentaje(categoria.saldo, deuda.resumen.saldoTotal)}
                  nota={`${plural(categoria.documentos, 'doc.', 'docs.')} · ${porcentaje(categoria.saldo, deuda.resumen.saldoTotal)} %`} />)}
              </ul>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Proveedores con mayor saldo pendiente</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600"><tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Proveedor</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-right">Docs.</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-right">Vencido</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-right">Saldo</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {deuda.proveedores.slice(0, PROVEEDORES_VISIBLES).map(item => <tr key={item.idProveedor}>
                      <td className="px-3 py-2 min-w-36"><span className="font-medium text-slate-900">{proveedorTexto(item.idProveedor, item.nombreProveedor)}</span>
                        <span className="block text-xs text-slate-600">{item.participacion} % de la deuda</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.cantidadDocumentos}</td>
                      <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${item.saldoVencido > 0 ? 'font-semibold text-red-700' : 'text-slate-600'}`}>{formatoMonto(item.saldoVencido, moneda)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-semibold">{formatoMonto(item.saldoTotal, moneda)}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
              {deuda.proveedores.length > PROVEEDORES_VISIBLES && <p className="text-xs text-slate-600 mt-2">
                Se muestran {PROVEEDORES_VISIBLES} de {deuda.proveedores.length} proveedores; el reporte incluye el ranking completo.</p>}
            </div>
          </div>}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel titulo="Estadística de compras" descripcion="Compras aprobadas del período, en quetzales." enlace={rutaReporte('estadistica', periodo)}>
          {estadistica.cargando ? <PanelCargando filas={6} />
            : estadistica.error || !estadistica.datos ? <PanelError mensaje={estadistica.error ?? 'Sin datos'} onReintentar={cargarEstadistica} />
            : !estadistica.datos.resumen.porMes.length ? <PanelVacio>No hay compras aprobadas entre el {formatoFecha(periodo.fechaInicio)} y el {formatoFecha(periodo.fechaFin)}.</PanelVacio>
            : (() => {
              const { resumen, totales, periodoComparable } = estadistica.datos;
              const total = resumen.porMes.reduce((suma, mes) => suma + mes.totalLocal, 0);
              const variacion = resumen.variacionTotal;
              const principales = resumen.porProveedor.slice(0, PROVEEDORES_VISIBLES);
              const otros = total - principales.reduce((suma, item) => suma + item.totalLocal, 0);
              return <div className="space-y-5">
                <dl className="grid grid-cols-3 gap-2">
                  <Cifra etiqueta="Compras aprobadas" valor={formatoLocal(total)} />
                  <Cifra etiqueta="Documentos" valor={String(totales.cantidadDocumentos)} nota={plural(resumen.porProveedor.length, 'proveedor', 'proveedores')} />
                  <Cifra etiqueta="Vs. período anterior" valor={variacion === null ? '—' : `${variacion > 0 ? '+' : ''}${variacion} %`}
                    nota={variacion === null ? 'Sin datos previos' : `Antes: ${formatoLocal(periodoComparable.totalLocal)}`} />
                </dl>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Evolución mensual</h3>
                  <GraficoColumnas formato={formatoLocal}
                    columnas={resumen.porMes.map(mes => ({ clave: mes.periodo, etiqueta: etiquetaMes(mes.periodo), valor: mes.totalLocal, detalle: plural(mes.cantidad, 'documento', 'documentos') }))} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Principales proveedores</h3>
                  <BarraSegmentada formato={formatoLocal} segmentos={[
                    ...principales.map((item, indice) => ({ clave: String(item.idProveedor), etiqueta: proveedorTexto(item.idProveedor, item.nombreProveedor), valor: item.totalLocal, color: serieColor(indice), detalle: `${item.participacion} %` })),
                    { clave: 'otros', etiqueta: 'Otros proveedores', valor: otros, color: 'bg-slate-300' },
                  ]} />
                  <ul className="mt-3 space-y-2">
                    {principales.map((item, indice) => <li key={item.idProveedor ?? 'sin'} className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 min-w-0"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${serieColor(indice)}`} aria-hidden="true" />
                        <span className="truncate font-medium text-slate-800">{proveedorTexto(item.idProveedor, item.nombreProveedor)}</span></span>
                      <span className="whitespace-nowrap tabular-nums"><span className="text-slate-600 mr-3">{item.participacion} %</span><span className="font-semibold">{formatoLocal(item.totalLocal)}</span></span>
                    </li>)}
                  </ul>
                </div>
              </div>;
            })()}
        </Panel>

        <Panel titulo="Retenciones de IVA e ISR" descripcion="Retenciones aplicadas a proveedores en el período." enlace={rutaReporte('retenciones', periodo)}>
          {retenciones.cargando ? <PanelCargando filas={6} />
            : retenciones.error || !retenido ? <PanelError mensaje={retenciones.error ?? 'Sin datos'} onReintentar={cargarRetenciones} />
            : !retenido.cantidad ? <PanelVacio>No hay retenciones en {moneda} entre el {formatoFecha(periodo.fechaInicio)} y el {formatoFecha(periodo.fechaFin)}.</PanelVacio>
            : <div className="space-y-5">
              <dl className="grid grid-cols-3 gap-2">
                <Cifra etiqueta="Total retenido" valor={formatoMonto(retenido.total, moneda)} />
                <Cifra etiqueta="Retenciones" valor={String(retenido.cantidad)} nota={plural(retenido.tributos.length, 'tipo', 'tipos')} />
                <Cifra etiqueta="Sin constancia" valor={String(retenido.sinConstancia)} tono={retenido.sinConstancia > 0 ? 'atencion' : 'positivo'}
                  nota={retenido.sinConstancia > 0 ? 'Por registrar' : 'Completas'} />
              </dl>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Distribución por tipo</h3>
                <ul className="space-y-3">
                  {retenido.tributos.map((tributo, indice) => <FilaDistribucion key={tributo.codigo} marcador color={serieColor(indice)}
                    etiqueta={<>{tributo.nombre} <span className="font-normal text-slate-500">· {tributo.codigo}</span></>}
                    valor={formatoMonto(tributo.monto, moneda)} porcentaje={porcentaje(tributo.monto, retenido.total)}
                    nota={`${plural(tributo.cantidad, 'ret.', 'ret.')} · ${porcentaje(tributo.monto, retenido.total)} %`} />)}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Retenciones a revisar</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600"><tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Proveedor</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Tipo</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Constancia</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-right">Importe</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {retenido.revisar.map(row => <tr key={row.idTributo} className={row.numeroConstancia ? '' : 'bg-amber-50/50'}>
                        <td className="px-3 py-2 min-w-32"><span className="font-medium text-slate-900">{proveedorTexto(row.idProveedor, row.nombreProveedor)}</span>
                          <span className="block text-xs text-slate-600">Doc. {row.numeroDocumento ?? `#${row.idDocumento}`} · {formatoFecha(row.fechaAplicacion)}</span></td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.nombreTributo ?? row.codigoTributo ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.numeroConstancia ?? <Insignia tono="atencion">Sin número</Insignia>}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-semibold">{formatoMonto(row.monto, row.moneda ?? moneda)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-600 mt-2">Una retención sin número de constancia es documentación pendiente de registrar; no es un pago ni una declaración pendiente.</p>
              </div>
            </div>}
        </Panel>
      </div>

      <Panel titulo="Detalle de cuentas por pagar"
        descripcion={<>Documentos con saldo al {formatoFecha(periodo.fechaFin)}. {diasAlerta !== null
          ? `Próximos a vencer: vencen en ${plural(diasAlerta, 'día', 'días')} o menos (parámetro DIAS_ALERTA_VENCIMIENTO).`
          : 'Sin el parámetro DIAS_ALERTA_VENCIMIENTO no se marcan documentos próximos a vencer.'}</>}>
        {antiguedad.cargando ? <PanelCargando filas={6} />
          : antiguedad.error || !antiguedad.datos ? <PanelError mensaje={antiguedad.error ?? 'Sin datos'} onReintentar={cargarAntiguedad} />
          : <DetallePendientes filas={antiguedad.datos.detalle} fechaCorte={antiguedad.datos.fechaCorte} diasAlerta={diasAlerta} />}
      </Panel>
    </div>
  </CxpLayout>;
}
