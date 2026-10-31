import { useEffect, useRef, useState } from 'react';
import type { CxpProveedorCoincidencias, CxpProveedorIdentidad } from '@erp/contracts';
import { TextInput } from '../../../shared/ui-kit';
import { apiClient, buildQueryString } from '../api';
import { useCxpFormGuard } from './CxpFormGuard';
import { useAuth } from '../auth/session';

const normal = (value: string | null) => (value ?? '').trim().toUpperCase();
export function useCxpProveedorIdentity({ idProveedor, nit, independent = false, onSelect, onNit }: {
  idProveedor: string; nit: string; independent?: boolean;
  onSelect: (supplier: CxpProveedorIdentidad | null, replaceNit?: boolean) => void; onNit: (nit: string) => void;
}) {
  const [profile, setProfile] = useState<CxpProveedorIdentidad | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const loadingSequence = useRef(0);
  const current = useRef({idProveedor,nit,onSelect,onNit,profile,independent});
  current.current = {idProveedor,nit,onSelect,onNit,profile,independent};
  const { confirm } = useCxpFormGuard();
  // Lectura informativa al editar: nunca sustituye la instantánea histórica del formulario.
  useEffect(() => {
    let active = true; setProfile(null);
    if (!idProveedor) return;
    apiClient.get<CxpProveedorCoincidencias>(`/cxp/proveedores/identidad${buildQueryString({id:idProveedor})}`)
      .then(result => { if (active) setProfile(result.proveedores[0] ?? null); }).catch(() => {});
    return () => { active = false; };
  }, [idProveedor]);
  const pick = async (supplier: CxpProveedorIdentidad, fromNit = false) => {
    const request = ++sequence.current, before = current.current;
    const replaceNit = !before.independent || fromNit;
    if (replaceNit && normal(before.nit) && normal(before.nit) !== normal(supplier.nit) && normal(before.nit) !== normal(before.profile?.nit ?? null)) {
      if (!await confirm({title:'¿Sustituir el NIT capturado?',description:`Se usará ${supplier.nit || 'sin NIT registrado'} de ${supplier.nombre}. Los datos específicos de la factura se conservarán.`,stay:'Conservar captura',discard:'Usar proveedor'})) return;
    }
    if (request !== sequence.current) return;
    before.onSelect(supplier,replaceNit); setProfile(supplier); setError('');
    setMessage(supplier.nit ? `Proveedor identificado: ${supplier.nombre} · NIT ${supplier.nit}${supplier.activo ? '' : ' · Inactivo en el catálogo'}.`
      : `${supplier.nombre} no tiene NIT registrado. Puedes capturar la identificación del comprobante y usar CUI/DPI en facturas especiales; el catálogo no se modifica.`);
  };
  const choose = async (id: string) => {
    if (!id) { sequence.current++; onSelect(null); setMessage(''); return; }
    const request = ++sequence.current, load = ++loadingSequence.current; setLoading(true); setError('');
    try {
      const result = await apiClient.get<CxpProveedorCoincidencias>(`/cxp/proveedores/identidad${buildQueryString({id})}`);
      if (request !== sequence.current) return;
      if (!result.proveedores[0]) throw new Error('El proveedor ya no existe. Vuelve a buscarlo.');
      await pick(result.proveedores[0]);
    } catch(reason) { if (request === sequence.current) setError(reason instanceof Error ? reason.message : 'No se pudo consultar el proveedor.'); }
    finally { if(load===loadingSequence.current)setLoading(false); }
  };
  const editNit = (value: string) => {
    sequence.current++; setMessage(''); onNit(value);
    const state = current.current;
    if (!state.independent && state.idProveedor && (!state.profile || state.profile.nit && normal(value) !== normal(state.profile.nit))) {
      onSelect(null); setMessage('Selecciona el proveedor que corresponde al NIT capturado. No se conserva una relación que haya dejado de coincidir.');
    }
  };
  return { choose, pick, editNit, profile, message, loading, error, retry: () => void choose(idProveedor) };
}

/** Autocompletado del NIT: selección parcial explícita y resolución exacta solo si es única. */
export function CxpNitInput({ id, label, value, onChange, onPick, autoResolve = true, disabled, error, helperText }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  onPick: (supplier: CxpProveedorIdentidad) => void; autoResolve?: boolean; disabled?: boolean; error?: string; helperText?: string;
}) {
  const {session}=useAuth();
  const [open,setOpen] = useState(false), [active,setActive] = useState(-1), [loading,setLoading] = useState(false);
  const [result,setResult] = useState<CxpProveedorCoincidencias | null>(null), [loadError,setLoadError] = useState(''), [attempt,setAttempt] = useState(0);
  const typed = useRef(false), resolved = useRef('');
  const wrapper = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick); pickRef.current = onPick;
  useEffect(() => {
    if (!open || value.trim().length < 2 || disabled) {setResult(null);setLoading(false);return;}
    let live = true; setLoading(true); setResult(null);setLoadError('');
    const timer = window.setTimeout(() => {
      void apiClient.get<CxpProveedorCoincidencias>(`/cxp/proveedores/identidad${buildQueryString({nit:value.trim()})}`)
        .then(next => {
          if (!live) return; setResult(next); setActive(-1);
          const exact = next.proveedores.filter(row => normal(row.nit) === normal(value));
          if (typed.current && autoResolve && next.coincidenciasExactas === 1 && exact.length === 1 && resolved.current !== normal(value)) {
            resolved.current = normal(value);setOpen(false);pickRef.current(exact[0]);
          }
        }).catch(reason => {if(live)setLoadError(reason instanceof Error ? reason.message : 'No se pudo buscar el NIT.');})
        .finally(() => {if(live)setLoading(false);});
    },250);
    return () => {live=false;window.clearTimeout(timer);};
  },[value,open,autoResolve,disabled,attempt]);
  const rows = result?.proveedores ?? [];
  useEffect(()=>{if(open&&active>=0)document.getElementById(`${id}-nit-${active}`)?.scrollIntoView({block:'nearest'});},[active,open,id]);
  const pick = (row: CxpProveedorIdentidad) => {setOpen(false);resolved.current=normal(value);onPick(row);document.getElementById(id)?.focus();};
  return <div ref={wrapper} className="relative min-w-0" onBlur={event => {if(!wrapper.current?.contains(event.relatedTarget as Node|null))setOpen(false);}}>
    <TextInput id={id} label={label} value={value} error={error} helperText={helperText} maxLength={20} autoComplete="off" isReadOnly={disabled}
      role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-sugerencias`} aria-activedescendant={active>=0?`${id}-nit-${active}`:undefined}
      onFocus={() => setOpen(true)} onChange={event => {typed.current=true;resolved.current='';setOpen(true);setResult(null);onChange(event.target.value);}}
      onKeyDown={event => {
        if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(n=>Math.min(rows.length-1,n+1));}
        if(event.key==='ArrowUp'){event.preventDefault();setActive(n=>Math.max(0,n-1));}
        if(event.key==='Home'&&open){event.preventDefault();setActive(rows.length?0:-1);}
        if(event.key==='End'&&open){event.preventDefault();setActive(rows.length-1);}
        if(event.key==='Enter'&&open){event.preventDefault();if(rows[active])pick(rows[active]);}
        if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);}
      }} />
    {open && value.trim().length>=2 && <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg">
      {loading && <p role="status" className="p-3 text-xs text-slate-500">Buscando proveedor por NIT…</p>}
      {loadError && <p role="alert" className="p-3 text-xs text-red-700">{loadError} <button type="button" className="underline" onClick={()=>setAttempt(n=>n+1)}>Reintentar</button></p>}
      {!loading && !loadError && result && !rows.length && <p role="status" className="p-3 text-xs text-slate-600">No hay proveedores con ese NIT. La captura se conserva.
        {session?.actor?.permisos.includes('CREAR')&&<> <a className="font-semibold text-blue-700 underline" href="/cxp/proveedores" target="_blank" rel="noopener noreferrer">Registrar proveedor en otra pestaña</a>. Después vuelve a buscar aquí.</>}
      </p>}
      {result && result.coincidenciasExactas>1 && <p role="status" className="p-3 text-xs text-amber-800">Varias fichas comparten este NIT. Selecciona el proveedor explícitamente.</p>}
      <ul id={`${id}-sugerencias`} role="listbox" aria-label="Proveedores por NIT" className="max-h-52 overflow-y-auto">
        {rows.map((row,index)=><li key={row.idProveedor} id={`${id}-nit-${index}`} role="option" aria-selected={active===index}
          className={`cursor-pointer px-3 py-2 text-sm ${active===index?'bg-blue-50':''}`} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>pick(row)}>
          <span className="font-semibold">{row.nit || 'Sin NIT'}</span> · {row.nombre} <span className="text-xs text-slate-500">#{row.idProveedor}{row.activo?'':' · Inactivo'}</span>
        </li>)}
      </ul>
      {result?.limitado && <p className="border-t p-2 text-xs text-slate-500">Primeras 20 coincidencias. Completa el NIT para precisar la búsqueda.</p>}
    </div>}
  </div>;
}
