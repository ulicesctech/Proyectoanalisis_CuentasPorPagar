import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, CopyPlus, Plus, RefreshCw, Search, TimerOff } from 'lucide-react';
import type { CxpReglaTributaria } from '@erp/contracts';
import { Modal } from '../../../shared/components';
import { Button, Select, TextInput } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { errorDe, formatoFecha, formatoMonto, reglasTributariasApi } from './api';
import { ReglaTributariaForm, type ModoRegla } from './components/ReglaTributariaForm';
import { UsuarioOperacion } from './components/UsuarioOperacion';

const ESTADOS: Record<string, string> = {
  VIGENTE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REEMPLAZADA: 'bg-slate-100 text-slate-600 border-slate-200',
  FINALIZADA: 'bg-amber-50 text-amber-800 border-amber-200',
};

const calculo = (regla: CxpReglaTributaria) =>
  `${regla.porcentaje}%${regla.sobreExcedente === 'S' ? ' del excedente' : ''}${regla.montoFijo ? ` + ${formatoMonto(regla.montoFijo, regla.moneda ?? '')}` : ''}`;
const tramo = (regla: CxpReglaTributaria) =>
  regla.baseHasta == null ? (regla.baseDesde ? `Desde ${formatoMonto(regla.baseDesde, '')}` : 'Toda base') : `${formatoMonto(regla.baseDesde, '')} – ${formatoMonto(regla.baseHasta, '')}`;
const vigencia = (regla: CxpReglaTributaria) => `${formatoFecha(regla.vigenteDesde)} → ${regla.vigenteHasta ? formatoFecha(regla.vigenteHasta) : 'sin fin'}`;

export function CxpReglasTributariasPage() {
  const [params] = useSearchParams();
  const [reglas, setReglas] = useState<CxpReglaTributaria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState(params.get('codigo') ?? '');
  const [estado, setEstado] = useState(params.get('codigo') ? '' : 'VIGENTE');
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(params.get('codigo') ? [params.get('codigo')!] : []));
  const [modal, setModal] = useState<{ modo: ModoRegla; regla?: CxpReglaTributaria } | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    reglasTributariasApi.list().then(result => { setReglas(result); setError(null); })
      .catch(reason => setError(errorDe(reason).mensaje)).finally(() => setCargando(false));
  }, []);
  useEffect(cargar, [cargar]);

  // Una fila por código de regla (su versión más reciente) con el historial de versiones desplegable.
  const grupos = useMemo(() => {
    const porCodigo = new Map<string, CxpReglaTributaria[]>();
    for (const regla of reglas) porCodigo.set(regla.codigoRegla, [...(porCodigo.get(regla.codigoRegla) ?? []), regla]);
    const texto = busqueda.trim().toUpperCase();
    return [...porCodigo.values()].map(versiones => versiones.sort((a, b) => b.versionRegla - a.versionRegla))
      .filter(([ultima]) => (!estado || ultima.estado === estado)
        && (!texto || [ultima.codigoRegla, ultima.codigoTributo, ultima.nombreTributo].some(value => value.toUpperCase().includes(texto))));
  }, [reglas, busqueda, estado]);

  const alternar = (codigo: string) => setAbiertas(actual => { const next = new Set(actual); if (next.has(codigo)) next.delete(codigo); else next.add(codigo); return next; });
  const hecho = (regla: CxpReglaTributaria) => {
    const texto = modal?.modo === 'crear' ? 'creada' : modal?.modo === 'version' ? `actualizada: versión ${regla.versionRegla} vigente desde ${formatoFecha(regla.vigenteDesde)}` : 'finalizada';
    setModal(null);
    setAviso(`Regla ${regla.codigoRegla} ${texto}.`);
    cargar();
  };

  return <CxpLayout screen="reglas-tributarias">
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div><p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Cuentas por pagar · Facturas especiales</p>
          <h1 className="text-2xl font-bold text-slate-900">Reglas tributarias</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">Porcentajes y montos de IVA e ISR con vigencia. Cada cambio crea una versión nueva; las facturas ya calculadas conservan la versión y los valores con que se procesaron.</p></div>
        <Button icon={Plus} onClick={() => { setAviso(null); setModal({ modo: 'crear' }); }}>Nueva regla</Button>
      </div>
      <UsuarioOperacion />
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <TextInput id="rt-buscar" icon={Search} label="Buscar" placeholder="Código de regla, tributo o nombre…" value={busqueda}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBusqueda(event.target.value)} className="flex-1 min-w-56" />
        <Select id="rt-estado" label="Estado de la versión actual" value={estado} placeholder="" className="sm:max-w-60"
          options={[{ value: '', label: 'Todas' }, { value: 'VIGENTE', label: 'Vigentes' }, { value: 'FINALIZADA', label: 'Finalizadas' }]}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setEstado(event.target.value)} />
        <Button icon={RefreshCw} variant="secondary" onClick={cargar} disabled={cargando}>Actualizar</Button>
      </div>
      {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</p>}
      {aviso && <p role="status" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm rounded-lg p-3">{aviso}</p>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead><tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {['Regla', 'Tributo', 'Cálculo', 'Tramo de base', 'Vigencia', 'Estado', 'Facturas', ''].map(header =>
              <th key={header} className={`px-4 py-3.5 whitespace-nowrap ${header === '' ? 'text-right' : ''}`}>{header}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-200/80 text-sm text-slate-800">
            {cargando ? <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">Cargando reglas…</td></tr>
              : !grupos.length ? <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-500">No hay reglas para mostrar. Crea las reglas de IVA e ISR con los valores vigentes.</td></tr>
              : grupos.map(versiones => {
                const [ultima] = versiones;
                const abierta = abiertas.has(ultima.codigoRegla);
                return <Fragment key={ultima.codigoRegla}>
                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button type="button" onClick={() => alternar(ultima.codigoRegla)} className="flex items-center gap-1.5 font-semibold text-slate-900" aria-expanded={abierta}>
                        {abierta ? <ChevronDown size={15} /> : <ChevronRight size={15} />}{ultima.codigoRegla}</button>
                      <span className="text-xs text-slate-500 ml-6">v{ultima.versionRegla} · {versiones.length} versión{versiones.length === 1 ? '' : 'es'}</span>
                    </td>
                    <td className="px-4 py-3.5 min-w-40"><p className="font-medium">{ultima.nombreTributo}</p>
                      <p className="text-xs text-slate-500">{ultima.codigoTributo} · {ultima.tipoTributo === 'RETENCION' ? 'Retención' : 'Impuesto'}{ultima.moneda ? ` · ${ultima.moneda}` : ''}</p></td>
                    <td className="px-4 py-3.5 min-w-32 font-semibold">{calculo(ultima)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">{tramo(ultima)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">{formatoFecha(ultima.vigenteDesde)}<span className="block text-xs text-slate-500">→ {ultima.vigenteHasta ? formatoFecha(ultima.vigenteHasta) : 'sin fin'}</span></td>
                    <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold border ${ESTADOS[ultima.estado]}`}>{ultima.estado}</span></td>
                    <td className="px-4 py-3.5">{versiones.reduce((total, item) => total + (item.documentosAplicados ?? 0), 0)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right"><div className="inline-flex flex-col items-stretch gap-1.5">
                      {ultima.estado === 'VIGENTE' && <>
                        <Button variant="secondary" icon={CopyPlus} title="Registrar una nueva versión con otros valores" onClick={() => { setAviso(null); setModal({ modo: 'version', regla: ultima }); }}>Nueva versión</Button>
                        <Button variant="secondary" icon={TimerOff} title="Finalizar la vigencia sin reemplazo" onClick={() => { setAviso(null); setModal({ modo: 'finalizar', regla: ultima }); }}>Finalizar</Button>
                      </>}
                    </div></td>
                  </tr>
                  {abierta && <tr><td colSpan={8} className="bg-slate-50 px-5 py-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Historial de versiones</p>
                    <ol className="space-y-2">
                      {versiones.map(version => <li key={version.idReglaTributaria} className="bg-white border border-slate-200 rounded-lg p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
                        <span className="font-semibold w-12">v{version.versionRegla}</span>
                        <span className="w-44">{calculo(version)}</span>
                        <span className="w-48">{vigencia(version)}</span>
                        <span className={`inline-flex h-fit rounded-full px-2 py-0.5 text-[11px] font-semibold border ${ESTADOS[version.estado]}`}>{version.estado}</span>
                        <span className="text-slate-500">{version.documentosAplicados ?? 0} facturas</span>
                        <span className="text-slate-500 flex-1 min-w-60">Creada {formatoFecha(version.fechaCreacion)} por usuario #{version.creadaPor}{version.motivoCambio ? ` · ${version.motivoCambio}` : ''}</span>
                      </li>)}
                    </ol>
                  </td></tr>}
                </Fragment>;
              })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!modal} onClose={() => setModal(null)} size="lg"
        title={modal?.modo === 'crear' ? 'Nueva regla tributaria' : modal?.modo === 'version' ? 'Nueva versión de la regla' : 'Finalizar vigencia'}
        description={modal?.modo === 'version' ? 'La versión actual se conserva y deja de aplicar el día anterior a la nueva fecha.' : undefined}>
        {modal && <ReglaTributariaForm modo={modal.modo} regla={modal.regla} onCancel={() => setModal(null)} onSuccess={hecho} />}
      </Modal>
    </div>
  </CxpLayout>;
}
