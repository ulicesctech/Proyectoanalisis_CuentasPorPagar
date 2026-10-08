/**
 * Zona horaria de negocio del ERP. Cliente y servidor calculan "hoy" con ella,
 * así una fecha no cambia de día según el reloj o la zona de cada máquina.
 */
export const CXP_TIME_ZONE = 'America/Guatemala';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CXP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** Fecha y hora actuales en la zona de negocio: YYYY-MM-DDTHH:MM:SS. */
export function cxpNow(date = new Date()): string {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Fecha actual en la zona de negocio: YYYY-MM-DD. */
export function cxpToday(date = new Date()): string {
  return cxpNow(date).slice(0, 10);
}
