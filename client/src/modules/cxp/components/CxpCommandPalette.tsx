import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { buscarPantalla, filtrarPantallas, type PantallaCxp } from '../navegacion/pantallas';
import { useRecientes } from '../navegacion/recientes';
import { useOperador } from '../operador/operador';
import './CxpCommandPalette.css';

interface Grupo { titulo: string; pantallas: PantallaCxp[] }

/** Agrupa por área en el orden del catálogo; sin búsqueda muestra primero las recientes. */
function agrupar(consulta: string, recientes: PantallaCxp[]): Grupo[] {
  const encontradas = filtrarPantallas(consulta);
  if (consulta.trim()) return [{ titulo: 'Resultados', pantallas: encontradas }];
  const grupos: Grupo[] = recientes.length ? [{ titulo: 'Recientes', pantallas: recientes }] : [];
  for (const pantalla of encontradas) {
    const grupo = grupos.find(item => item.titulo === pantalla.group);
    if (grupo) grupo.pantallas.push(pantalla);
    else grupos.push({ titulo: pantalla.group, pantallas: [pantalla] });
  }
  return grupos;
}

/**
 * Buscador de pantallas (⌘K / Ctrl+K o "/"): combobox con lista de opciones,
 * navegable con flechas, Enter para abrir y Escape para cerrar.
 */
export function CxpCommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { actorId } = useOperador();
  const visitas = useRecientes(actorId);
  const [consulta, setConsulta] = useState('');
  const [activa, setActiva] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previo = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const listaId = `${baseId}-lista`;

  const recientes = useMemo(() => visitas.map(visita => buscarPantalla(visita.path))
    .filter((pantalla): pantalla is PantallaCxp => pantalla !== undefined).slice(0, 4), [visitas]);
  const grupos = useMemo(() => agrupar(consulta, recientes), [consulta, recientes]);
  const opciones = useMemo(() => grupos.flatMap(grupo => grupo.pantallas), [grupos]);
  const opcionId = (indice: number) => `${baseId}-opcion-${indice}`;

  useEffect(() => {
    if (!open) return;
    previo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConsulta('');
    setActiva(0);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const foco = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(foco);
      document.body.style.overflow = overflow;
      previo.current?.focus();
    };
  }, [open]);

  useEffect(() => { setActiva(0); }, [consulta]);
  useEffect(() => {
    if (open) document.getElementById(`${baseId}-opcion-${activa}`)?.scrollIntoView({ block: 'nearest' });
  }, [activa, open, baseId]);

  if (!open) return null;

  const abrir = (pantalla: PantallaCxp | undefined) => {
    if (!pantalla) return;
    onClose();
    navigate(pantalla.path);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!opciones.length) return;
      const paso = event.key === 'ArrowDown' ? 1 : -1;
      setActiva(actual => (actual + paso + opciones.length) % opciones.length);
    } else if (event.key === 'Home' && opciones.length) {
      event.preventDefault(); setActiva(0);
    } else if (event.key === 'End' && opciones.length) {
      event.preventDefault(); setActiva(opciones.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault(); abrir(opciones[activa]);
    } else if (event.key === 'Escape') {
      event.preventDefault(); onClose();
    } else if (event.key === 'Tab') {
      // El cuadro de diálogo solo tiene un control enfocable: el foco se queda aquí.
      event.preventDefault();
    }
  };

  let indice = -1;
  return createPortal(<div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
    <div aria-hidden="true" className="cxp-palette-overlay absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onMouseDown={onClose} />
    <div role="dialog" aria-modal="true" aria-label="Buscar pantallas"
      className="cxp-palette-panel relative flex max-h-[min(560px,76vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4">
        <Search size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
        <input ref={inputRef} type="text" value={consulta} onChange={event => setConsulta(event.target.value)} onKeyDown={onKeyDown}
          role="combobox" aria-expanded="true" aria-controls={listaId} aria-autocomplete="list"
          aria-activedescendant={opciones.length ? opcionId(activa) : undefined} aria-label="Buscar pantallas"
          placeholder="Buscar pantallas: documentos, pagos, reportes…" autoComplete="off" spellCheck={false}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" />
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 sm:block">Esc</kbd>
      </div>
      <div id={listaId} role="listbox" aria-label="Pantallas" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {opciones.length === 0 && <p role="status" className="px-3 py-10 text-center text-sm text-slate-500">
          No hay pantallas que coincidan con “{consulta.trim()}”.
        </p>}
        {grupos.map(grupo => {
          const tituloId = `${baseId}-${grupo.titulo.replace(/\s+/g, '-')}`;
          return <div key={grupo.titulo} role="group" aria-labelledby={tituloId} className="pb-1">
            <div id={tituloId} className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{grupo.titulo}</div>
            {grupo.pantallas.map(pantalla => {
              indice += 1;
              const propio = indice;
              const seleccionada = propio === activa;
              const Icon = pantalla.icon;
              return <div key={`${grupo.titulo}-${pantalla.path}`} id={opcionId(propio)} role="option" aria-selected={seleccionada}
                onMouseMove={() => { if (!seleccionada) setActiva(propio); }} onClick={() => abrir(pantalla)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${seleccionada ? 'bg-blue-50' : ''}`}>
                <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-md ${seleccionada ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className={`block truncate text-sm font-medium ${seleccionada ? 'text-blue-800' : 'text-slate-900'}`}>{pantalla.title}</span>
                  {(grupo.titulo === 'Recientes' || grupo.titulo === 'Resultados') && pantalla.group !== 'Inicio'
                    && <span className="block truncate text-xs text-slate-500">{pantalla.group}</span>}
                </span>
                {seleccionada && <CornerDownLeft size={15} aria-hidden="true" className="shrink-0 text-blue-600" />}
              </div>;
            })}
          </div>;
        })}
      </div>
      <div className="flex items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
        <span><kbd className="font-sans font-semibold">↑ ↓</kbd> navegar</span>
        <span><kbd className="font-sans font-semibold">Enter</kbd> abrir</span>
        <span><kbd className="font-sans font-semibold">Esc</kbd> cerrar</span>
      </div>
    </div>
  </div>, document.body);
}
