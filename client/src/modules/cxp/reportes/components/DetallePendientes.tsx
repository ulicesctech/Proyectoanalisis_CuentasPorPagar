import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Search } from 'lucide-react';
import type { CxpAntiguedadDetalle } from '@erp/contracts';
import { formatoFecha, formatoMonto } from '../../facturas-especiales/api';
import { diasEntre } from '../api';
import { Insignia, PanelVacio, type Tono } from './Visuales';
import { Paginacion } from './ReporteComponentes';

const POR_PAGINA = 10;

export type Situacion = 'VENCIDA' | 'PROXIMA' | 'AL_DIA' | 'SIN_VENCIMIENTO';

const SITUACION: Record<Situacion, { etiqueta: string; tono: Tono }> = {
  VENCIDA: { etiqueta: 'Vencida', tono: 'vencido' },
  PROXIMA: { etiqueta: 'Próxima a vencer', tono: 'atencion' },
  AL_DIA: { etiqueta: 'Al día', tono: 'positivo' },
  SIN_VENCIMIENTO: { etiqueta: 'Sin vencimiento', tono: 'neutro' },
};

/**
 * Situación de pago al corte (no es el estado del documento en CXP_DOCUMENTO). "Próxima a vencer"
 * solo se marca si existe el parámetro DIAS_ALERTA_VENCIMIENTO.
 */
export function situacionDe(row: CxpAntiguedadDetalle, fechaCorte: string, diasAlerta: number | null): { situacion: Situacion; diasParaVencer: number | null } {
  if (row.diasAntiguedad > 0) return { situacion: 'VENCIDA', diasParaVencer: null };
  if (!row.fechaVencimiento) return { situacion: 'SIN_VENCIMIENTO', diasParaVencer: null };
  const dias = diasEntre(fechaCorte, row.fechaVencimiento.slice(0, 10));
  return { situacion: diasAlerta !== null && dias <= diasAlerta ? 'PROXIMA' : 'AL_DIA', diasParaVencer: dias };
}

type Orden = 'vencimiento' | 'atraso' | 'original' | 'saldo' | 'proveedor';
const proveedorTexto = (row: CxpAntiguedadDetalle) => row.nombreProveedor ?? `Proveedor #${row.idProveedor}`;

export function DetallePendientes({ filas, fechaCorte, diasAlerta }: { filas: CxpAntiguedadDetalle[]; fechaCorte: string; diasAlerta: number | null }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Situacion | ''>('');
  const [orden, setOrden] = useState<{ campo: Orden; asc: boolean }>({ campo: 'atraso', asc: false });
  const [pagina, setPagina] = useState(1);

  const conSituacion = useMemo(() => filas.map(row => ({ row, ...situacionDe(row, fechaCorte, diasAlerta) })), [filas, fechaCorte, diasAlerta]);
  const conteo = useMemo(() => conSituacion.reduce<Record<Situacion, number>>((total, item) => ({ ...total, [item.situacion]: total[item.situacion] + 1 }),
    { VENCIDA: 0, PROXIMA: 0, AL_DIA: 0, SIN_VENCIMIENTO: 0 }), [conSituacion]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const valor = (item: (typeof conSituacion)[number]): number | string => {
      switch (orden.campo) {
        case 'vencimiento': return item.row.fechaVencimiento ?? '9999-12-31';
        case 'original': return item.row.totalNeto;
        case 'saldo': return item.row.saldoHistorico;
        case 'proveedor': return proveedorTexto(item.row).toLowerCase();
        default: return item.row.diasAntiguedad - (item.diasParaVencer ?? 99999) / 100000;
      }
    };
    return conSituacion
      .filter(item => (!filtro || item.situacion === filtro) && (!texto || [item.row.numeroDocumento, proveedorTexto(item.row), item.row.tipoDocumento]
        .some(campo => campo?.toLowerCase().includes(texto))))
      .sort((a, b) => {
        const [x, y] = [valor(a), valor(b)];
        const comparacion = typeof x === 'string' ? x.localeCompare(String(y)) : x - Number(y);
        return (orden.asc ? comparacion : -comparacion) || a.row.idDocumento - b.row.idDocumento;
      });
  }, [conSituacion, busqueda, filtro, orden]);

  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const ordenar = (campo: Orden) => { setOrden(previo => ({ campo, asc: previo.campo === campo ? !previo.asc : campo === 'vencimiento' || campo === 'proveedor' })); setPagina(1); };

  const encabezado = (campo: Orden, children: string, derecha = false) => {
    const activo = orden.campo === campo;
    const Icono = !activo ? ArrowUpDown : orden.asc ? ArrowUp : ArrowDown;
    return <th scope="col" aria-sort={activo ? (orden.asc ? 'ascending' : 'descending') : 'none'} className={`px-3 py-2.5 whitespace-nowrap ${derecha ? 'text-right' : ''}`}>
      <button type="button" onClick={() => ordenar(campo)} className={`inline-flex items-center gap-1 font-semibold rounded hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activo ? 'text-slate-900' : ''}`}>
        {children}<Icono size={13} aria-hidden="true" className={activo ? '' : 'opacity-50'} /></button>
    </th>;
  };

  if (!filas.length) return <PanelVacio>No hay documentos con saldo pendiente al {formatoFecha(fechaCorte)}.</PanelVacio>;

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex-1 min-w-56 max-w-sm">
        <span className="sr-only">Buscar documento o proveedor</span>
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" value={busqueda} onChange={event => { setBusqueda(event.target.value); setPagina(1); }} placeholder="Buscar documento o proveedor"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
      </label>
      <div role="group" aria-label="Filtrar por situación" className="flex flex-wrap gap-1.5">
        {([['', 'Todos', filas.length], ['VENCIDA', 'Vencidas', conteo.VENCIDA], ['PROXIMA', 'Próximas a vencer', conteo.PROXIMA],
          ['AL_DIA', 'Al día', conteo.AL_DIA], ['SIN_VENCIMIENTO', 'Sin vencimiento', conteo.SIN_VENCIMIENTO]] as [Situacion | '', string, number][])
          .filter(([clave, , cantidad]) => clave === '' || cantidad > 0 || (clave === 'PROXIMA' && diasAlerta !== null))
          .map(([clave, etiqueta, cantidad]) => <button key={clave || 'todos'} type="button" aria-pressed={filtro === clave}
            onClick={() => { setFiltro(clave); setPagina(1); }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${filtro === clave
              ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {etiqueta} <span className="tabular-nums opacity-80">{cantidad}</span></button>)}
      </div>
    </div>

    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600"><tr>
          <th scope="col" className="px-3 py-2.5 font-semibold">Documento</th>
          {encabezado('proveedor', 'Proveedor')}
          <th scope="col" className="px-3 py-2.5 font-semibold whitespace-nowrap">Emisión</th>
          {encabezado('vencimiento', 'Vencimiento')}
          {encabezado('atraso', 'Atraso (días)', true)}
          {encabezado('original', 'Importe', true)}
          {encabezado('saldo', 'Saldo', true)}
          <th scope="col" className="px-3 py-2.5 font-semibold">Situación</th>
          <th scope="col" className="px-3 py-2.5 font-semibold text-right">Acciones</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {visibles.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA).map(({ row, situacion, diasParaVencer }) =>
            <tr key={row.idDocumento} className={situacion === 'VENCIDA' ? 'bg-red-50/40 hover:bg-red-50' : situacion === 'PROXIMA' ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}>
              <td className={`px-3 py-2.5 max-w-48 break-all border-l-4 ${situacion === 'VENCIDA' ? 'border-l-red-500' : situacion === 'PROXIMA' ? 'border-l-amber-500' : 'border-l-transparent'}`}>
                <span className="font-semibold text-slate-900">{row.numeroDocumento ?? `#${row.idDocumento}`}</span>
                <span className="block text-xs text-slate-600">{row.tipoDocumento ?? '—'}</span></td>
              <td className="px-3 py-2.5 min-w-32">{proveedorTexto(row)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{formatoFecha(row.fechaDocumento)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{formatoFecha(row.fechaVencimiento)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums ${row.diasAntiguedad > 0 ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
                {row.diasAntiguedad > 0 ? row.diasAntiguedad : '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{formatoMonto(row.totalNeto, row.moneda ?? '')}</td>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold text-slate-900">{formatoMonto(row.saldoHistorico, row.moneda ?? '')}</td>
              <td className="px-3 py-2.5 whitespace-nowrap"><Insignia tono={SITUACION[situacion].tono}>{SITUACION[situacion].etiqueta}</Insignia>
                {situacion === 'PROXIMA' && diasParaVencer !== null && <span className="block text-xs text-amber-800 mt-0.5">
                  {diasParaVencer === 0 ? 'Vence hoy' : `Vence en ${diasParaVencer} ${diasParaVencer === 1 ? 'día' : 'días'}`}</span>}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                <Link to={`/cxp/documentos/${row.idDocumento}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  Expediente<ExternalLink size={14} aria-hidden="true" /></Link></td>
            </tr>)}
          {!visibles.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-600">Ningún documento coincide con la búsqueda o el filtro.</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="rounded-lg overflow-hidden"><Paginacion pagina={actual} paginas={paginas} onCambiar={setPagina} /></div>
  </div>;
}
