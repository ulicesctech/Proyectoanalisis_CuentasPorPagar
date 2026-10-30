// Pantallas visitadas recientemente, por usuario operativo y solo en este navegador.
// Es una comodidad: si el almacenamiento no está disponible, la lista queda vacía.
import { useEffect, useState } from 'react';
import { buscarPantalla } from './pantallas';

export interface VisitaReciente { path: string; at: number }

const LIMITE = 6;
const EVENTO = 'cxp:recientes';
const clave = (actorId: string) => `cxp:recientes:v1:${actorId}`;

function leer(actorId: string): VisitaReciente[] {
  if (!actorId) return [];
  try {
    const guardado: unknown = JSON.parse(window.localStorage.getItem(clave(actorId)) ?? '[]');
    if (!Array.isArray(guardado)) return [];
    return guardado
      .filter((item): item is VisitaReciente => typeof item?.path === 'string' && typeof item?.at === 'number'
        && buscarPantalla(item.path) !== undefined)
      .slice(0, LIMITE);
  } catch {
    return [];
  }
}

/** Guarda la visita a una pantalla del catálogo; el inicio no se registra. */
export function registrarVisita(actorId: string, path: string) {
  const pantalla = buscarPantalla(path);
  if (!actorId || !pantalla || pantalla.path === '/cxp') return;
  const siguiente = [{ path: pantalla.path, at: Date.now() }, ...leer(actorId).filter(item => item.path !== pantalla.path)]
    .slice(0, LIMITE);
  try {
    window.localStorage.setItem(clave(actorId), JSON.stringify(siguiente));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function useRecientes(actorId: string): VisitaReciente[] {
  const [items, setItems] = useState<VisitaReciente[]>(() => leer(actorId));
  useEffect(() => {
    const actualizar = () => setItems(leer(actorId));
    actualizar();
    window.addEventListener(EVENTO, actualizar);
    window.addEventListener('storage', actualizar);
    return () => {
      window.removeEventListener(EVENTO, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, [actorId]);
  return items;
}

const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** "hace 5 minutos", "ayer"… a partir de una marca de tiempo. */
export function tiempoRelativo(at: number, ahora = Date.now()): string {
  const segundos = Math.round((at - ahora) / 1000);
  if (segundos > -60) return 'hace un momento';
  const minutos = Math.round(segundos / 60);
  if (minutos > -60) return relativo.format(minutos, 'minute');
  const horas = Math.round(minutos / 60);
  if (horas > -24) return relativo.format(horas, 'hour');
  return relativo.format(Math.round(horas / 24), 'day');
}
