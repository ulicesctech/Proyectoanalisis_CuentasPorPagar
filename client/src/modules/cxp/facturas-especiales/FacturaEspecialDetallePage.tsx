import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileWarning, Pencil } from 'lucide-react';
import type { CxpFacturaEspecialDetalle } from '@erp/contracts';
import { Modal } from '../../../shared/components';
import { Button, DataTable } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { errorDe, facturasEspecialesApi, formatoFecha, formatoMonto, type AccionFlujo } from './api';
import { AccionDialog, BotonAccion } from './components/AccionDialog';
import { ACCIONES, ORDEN_ACCIONES } from './components/acciones';
import { EtapaBadge, FlujoFactura } from './components/Etapa';
import { FacturaEspecialForm } from './components/FacturaEspecialForm';
import { UsuarioOperacion } from './components/UsuarioOperacion';

const TABS = ['Resumen', 'Tributos', 'Aprobaciones', 'Historial'] as const;

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm font-medium text-slate-900 mt-0.5 break-words">{children || '—'}</dd></div>;
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-w-0">
    <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-4">{titulo}</h2>{children}
  </section>;
}

export function CxpFacturaEspecialDetallePage() {
  const id = Number(useParams().id);
  const location = useLocation();
  const [factura, setFactura] = useState<CxpFacturaEspecialDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>((location.state as { mensaje?: string } | null)?.mensaje ?? null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Resumen');
  const [accion, setAccion] = useState<AccionFlujo | null>(null);
  const [editando, setEditando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const cargar = useCallback(() => {
    facturasEspecialesApi.get(id).then(result => { setFactura(result); setError(null); }).catch(reason => setError(errorDe(reason).mensaje));
  }, [id]);
  useEffect(cargar, [cargar]);

  const descargar = async () => {
    setDescargando(true);
    try { await facturasEspecialesApi.descargarConstancia(id); }
    catch (reason) { setError(errorDe(reason).mensaje); }
    finally { setDescargando(false); }
  };
  const nombre = (usuario: number | null) => {
    if (!usuario) return '—';
    return factura?.historial.find(item => item.usuarioEvento === usuario)?.usuario
      ?? factura?.aprobaciones.find(item => item.idUsuarioAprobador === usuario)?.usuarioAprobador ?? `Usuario #${usuario}`;
  };

  return <CxpLayout screen="facturas-especiales">
    <div className="space-y-5">
      <Link to="/cxp/facturas-especiales" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"><ArrowLeft size={15} /> Facturas especiales</Link>
      {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</p>}
      {!factura ? (!error && <p className="text-sm text-slate-500">Cargando factura especial…</p>) : <>
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Factura especial · Documento #{factura.idDocumento}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{factura.serie}-{factura.numeroDocumento}</h1>
              <EtapaBadge etapa={factura.etapa} />
            </div>
            <p className="text-sm text-slate-500 mt-1">{factura.proveedorNombre} · {formatoFecha(factura.fechaDocumento)}
              {factura.numeroConstancia && <> · Constancia <span className="font-semibold text-slate-700">{factura.numeroConstancia}</span></>}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {factura.acciones.includes('editar') && <Button variant="secondary" icon={Pencil} onClick={() => setEditando(true)}>Editar</Button>}
            {factura.acciones.includes('constancia') && <Button variant="secondary" icon={Download} onClick={descargar} disabled={descargando}>{descargando ? 'Descargando…' : 'Descargar constancia'}</Button>}
            {ORDEN_ACCIONES.filter(item => factura.acciones.includes(ACCIONES[item].clave)).map(item =>
              <BotonAccion key={item} accion={item} onClick={() => { setAviso(null); setAccion(item); }} />)}
          </div>
        </div>
        <FlujoFactura etapa={factura.etapa} emitida={!!factura.numeroConstancia} />
        {factura.acciones.some(item => item !== 'constancia') && <UsuarioOperacion />}
        {aviso && <p role="status" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm rounded-lg p-3">{aviso}</p>}
        {factura.etapa === 'ANULADA' && <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-sm text-red-800">
          <FileWarning size={18} className="shrink-0 mt-0.5" />
          <div><p className="font-semibold">Anulada el {formatoFecha(factura.fechaAnulacion)} por {nombre(factura.anuladoPor)}</p><p>Motivo: {factura.motivoAnulacion}</p>
            <p className="text-xs mt-1">El documento, sus tributos{factura.numeroConstancia ? ' y la constancia' : ''} se conservan como historial.</p></div>
        </div>}
        {factura.etapa === 'RECHAZADA' && factura.motivoRechazo && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <p className="font-semibold">Motivo del rechazo</p><p>{factura.motivoRechazo}</p></div>}

        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto" role="tablist">
          {TABS.map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === item ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {item}{item === 'Historial' ? ` (${factura.historial.length})` : item === 'Tributos' ? ` (${factura.tributos.length})` : ''}</button>)}
        </div>

        {tab === 'Resumen' && <div className="grid lg:grid-cols-2 gap-5">
          <Tarjeta titulo="Proveedor">
            <dl className="grid sm:grid-cols-2 gap-4">
              <Dato label="Nombre">{factura.proveedorNombre}</Dato>
              <Dato label="Proveedor en catálogo">#{factura.idProveedor}</Dato>
              <Dato label="NIT">{factura.proveedorNit}</Dato>
              <Dato label="CUI / DPI">{factura.proveedorCui}</Dato>
              <div className="sm:col-span-2"><Dato label="Dirección">{factura.proveedorDireccion}</Dato></div>
            </dl>
          </Tarjeta>
          <Tarjeta titulo="Operación">
            <dl className="grid sm:grid-cols-2 gap-4">
              <Dato label="Fecha de la operación">{formatoFecha(factura.fechaDocumento)}</Dato>
              <Dato label="Vencimiento">{formatoFecha(factura.fechaVencimiento)}</Dato>
              <Dato label="Referencia">{factura.referenciaExterna}</Dato>
              <Dato label="Moneda / tipo de cambio">{factura.moneda} · {factura.tipoCambio}</Dato>
              <div className="sm:col-span-2"><Dato label="Descripción">{factura.descripcionOperacion}</Dato></div>
            </dl>
          </Tarjeta>
          <Tarjeta titulo="Montos">
            <dl className="space-y-2 text-sm">
              {([['Monto de la operación', factura.subtotal], ['Descuento', factura.descuentoTotal], ['Impuestos (IVA)', factura.impuestoTotal],
                ['Total de retenciones', -factura.retencionTotal]] as Array<[string, number]>).map(([label, value]) =>
                <div key={label} className="flex justify-between"><dt className="text-slate-500">{label}</dt><dd className="font-medium">{formatoMonto(value, factura.moneda)}</dd></div>)}
              <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-semibold">Total a pagar al proveedor</dt><dd className="font-bold">{formatoMonto(factura.totalNeto, factura.moneda)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Saldo pendiente</dt><dd className="font-medium">{formatoMonto(factura.saldoPendiente, factura.moneda)}</dd></div>
            </dl>
          </Tarjeta>
          <Tarjeta titulo="Emisión y control">
            <dl className="grid sm:grid-cols-2 gap-4">
              <Dato label="Registrada por">{nombre(factura.creadoPor)} · {formatoFecha(factura.fechaCreacion)}</Dato>
              <Dato label="Revisada por">{factura.revisadoPor ? `${nombre(factura.revisadoPor)} · ${formatoFecha(factura.fechaRevision)}` : null}</Dato>
              <Dato label="Constancia">{factura.numeroConstancia}</Dato>
              <Dato label="Emitida">{factura.emitidoPor ? `${formatoFecha(factura.fechaEmision)} · ${nombre(factura.emitidoPor)}` : null}</Dato>
              <Dato label="Estado del documento">{factura.estado.replace(/_/g, ' ')}</Dato>
              <Dato label="Estado contable">{factura.estadoContable.replace(/_/g, ' ')}</Dato>
              {factura.hashConstancia && <div className="sm:col-span-2"><Dato label="Código de verificación"><span className="font-mono text-xs break-all">{factura.hashConstancia}</span></Dato></div>}
            </dl>
          </Tarjeta>
        </div>}

        {tab === 'Tributos' && <DataTable data={factura.tributos} emptyText="Sin tributos calculados." columns={[
          { header: 'Tributo', cell: ({ row }: any) => <div><p className="font-medium">{row.nombreTributo}</p><p className="text-xs text-slate-500">{row.codigoTributo} · {row.tipoTributo === 'RETENCION' ? 'Retención' : 'Impuesto'}</p></div> },
          { header: 'Regla aplicada', cell: ({ row }: any) => row.codigoRegla ? <Link className="text-blue-700 underline underline-offset-2" to={`/cxp/reglas-tributarias?codigo=${encodeURIComponent(row.codigoRegla)}`}>{row.codigoRegla} v{row.versionRegla}</Link> : 'Manual' },
          { header: 'Base', align: 'right', cell: ({ row }: any) => formatoMonto(row.baseImponible, factura.moneda) },
          { header: '%', align: 'right', cell: ({ row }: any) => `${row.porcentaje}%` },
          { header: 'Monto', align: 'right', cell: ({ row }: any) => <span className="font-semibold">{formatoMonto(row.monto, factura.moneda)}</span> },
          { header: 'Periodo', accessorKey: 'periodoFiscal' },
          { header: 'Estado', cell: ({ row }: any) => row.estado },
          { header: 'Constancia', cell: ({ row }: any) => row.numeroConstancia ?? '—' },
        ]} />}

        {tab === 'Aprobaciones' && <DataTable data={factura.aprobaciones} emptyText="Aún no hay decisiones de aprobación." columns={[
          { header: 'Decisión', cell: ({ row }: any) => <span className={`font-semibold ${row.estado === 'APROBADA' ? 'text-emerald-700' : row.estado === 'RECHAZADA' ? 'text-red-700' : 'text-slate-600'}`}>{row.estado}</span> },
          { header: 'Nivel', accessorKey: 'nivel' },
          { header: 'Usuario', cell: ({ row }: any) => row.usuarioAprobador ?? (row.idUsuarioAprobador ? `Usuario #${row.idUsuarioAprobador}` : '—') },
          { header: 'Fecha', cell: ({ row }: any) => formatoFecha(row.fechaDecision ?? row.fechaSolicitud) },
          { header: 'Observación', cell: ({ row }: any) => <span className="block max-w-80 truncate" title={row.observacion ?? ''}>{row.observacion ?? '—'}</span> },
        ]} />}

        {tab === 'Historial' && <ol className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {factura.historial.map(item => <li key={item.idEvento} className="p-4 flex flex-wrap gap-x-6 gap-y-1">
            <div className="w-40 shrink-0 text-xs text-slate-500">{formatoFecha(item.fechaEvento)}<br />{item.usuario ?? `Usuario #${item.usuarioEvento}`}</div>
            <div className="flex-1 min-w-60">
              <p className="text-sm font-semibold text-slate-900">{item.asunto}</p>
              {(item.estadoAnterior || item.estadoNuevo) && <p className="text-xs text-slate-600 mt-0.5">{(item.estadoAnterior ?? '—').replace(/_/g, ' ')} → {(item.estadoNuevo ?? '—').replace(/_/g, ' ')}</p>}
              {item.detalle && <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{item.detalle}</p>}
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">{item.tipoEvento.replace(/_/g, ' ')}</span>
          </li>)}
          {!factura.historial.length && <li className="p-6 text-sm text-slate-500 text-center">Sin movimientos registrados.</li>}
        </ol>}

        <Modal isOpen={editando} onClose={() => setEditando(false)} size="lg" title={`Editar · ${factura.serie}-${factura.numeroDocumento}`}
          description="Los tributos se recalculan con las reglas vigentes en la fecha de la operación.">
          {editando && <FacturaEspecialForm factura={factura} onCancel={() => setEditando(false)}
            onSuccess={resultado => { setEditando(false); setFactura(resultado.factura); setAviso(resultado.mensaje); }} />}
        </Modal>
        <AccionDialog idDocumento={factura.idDocumento} accion={accion} onClose={() => setAccion(null)}
          onDone={resultado => { setAccion(null); setFactura(resultado.factura); setAviso(resultado.mensaje); }} />
      </>}
    </div>
  </CxpLayout>;
}
