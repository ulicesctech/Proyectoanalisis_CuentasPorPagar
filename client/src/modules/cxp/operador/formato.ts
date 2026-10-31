// Presentación legible de la identidad de la sesión (nombre, rol e iniciales).
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
const ROLES: Record<string, string> = {
  OPERADOR_CXP: 'Operador CXP',
  APROBADOR_CXP: 'Aprobador CXP',
  TESORERIA_CXP: 'Tesorería CXP',
  SUPERVISOR_CXP: 'Supervisor CXP',
};

/** "CXP DEMO CREADOR" → "CXP Demo Creador": conserva siglas (palabras sin vocales) y partículas en minúscula. */
export function nombreLegible(nombre?: string | null): string {
  return (nombre ?? '').trim().split(/\s+/).filter(Boolean).map((palabra, indice) => {
    const minuscula = palabra.toLocaleLowerCase('es');
    if (indice > 0 && PARTICULAS.has(minuscula)) return minuscula;
    if (!/[aeiouáéíóúü]/i.test(palabra)) return palabra.toLocaleUpperCase('es');
    return minuscula.charAt(0).toLocaleUpperCase('es') + minuscula.slice(1);
  }).join(' ');
}

/** "OPERADOR_CXP" → "Operador CXP". */
export function rolLegible(rol?: string | null): string {
  if (!rol) return 'Rol activo';
  return ROLES[rol] ?? nombreLegible(rol.replace(/_/g, ' '));
}

/** Dos iniciales, igual que el pie de la barra lateral. */
export function iniciales(nombre?: string | null): string {
  const letras = (nombre ?? '').trim().split(/\s+/).slice(0, 2).map(parte => parte[0] ?? '').join('');
  return (letras || 'CP').toLocaleUpperCase('es');
}
