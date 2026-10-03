import { useState } from 'react';
import type { CxpFacturaEspecialResumen } from '@erp/contracts';
import { CxpLayout } from '../CxpLayout';
import type { AccionFlujo } from './api';
import { AccionDialog, BotonAccion } from './components/AccionDialog';
import { ListadoFacturas } from './components/ListadoFacturas';
import { UsuarioOperacion } from './components/UsuarioOperacion';

/** Bandeja de trabajo de revisores y aprobadores. */
export function CxpRevisionAprobacionPage() {
  const [accion, setAccion] = useState<{ id: number; accion: AccionFlujo } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const abrir = (id: number, nombre: AccionFlujo) => { setAviso(null); setAccion({ id, accion: nombre }); };

  return <CxpLayout screen="facturas-especiales/revision">
    <div className="space-y-5">
      <div><p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Cuentas por pagar · Facturas especiales</p>
        <h1 className="text-2xl font-bold text-slate-900">Revisión y aprobación</h1>
        <p className="text-sm text-slate-500 mt-1">Facturas especiales pendientes de revisión o de aprobación. Abre una fila para ver su detalle completo.</p></div>
      <UsuarioOperacion />
      {aviso && <p role="status" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm rounded-lg p-3">{aviso}</p>}
      <ListadoFacturas etapas={['BANDEJA', 'REVISION', 'APROBACION']} etapaInicial="BANDEJA" recarga={recarga} accionesEstandar={false}
        acciones={(factura: CxpFacturaEspecialResumen) => (factura.etapa === 'REVISION' ? (['revisar', 'devolver'] as const)
          : factura.etapa === 'APROBACION' ? (['aprobar', 'rechazar'] as const) : [])
          .map(item => <BotonAccion key={item} accion={item} onClick={() => abrir(factura.idDocumento, item)} />)} />
      <AccionDialog idDocumento={accion?.id ?? 0} accion={accion?.accion ?? null} onClose={() => setAccion(null)}
        onDone={resultado => { setAccion(null); setAviso(`${resultado.factura.serie}-${resultado.factura.numeroDocumento}: ${resultado.mensaje}`); setRecarga(value => value + 1); }} />
    </div>
  </CxpLayout>;
}
