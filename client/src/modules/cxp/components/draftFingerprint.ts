/** Compara contenido, sin depender del orden de las propiedades ni de la referencia del objeto. */
export function draftFingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, current) => current && typeof current === 'object' && !Array.isArray(current)
    ? Object.fromEntries(Object.keys(current).sort().map(key => [key, current[key]])) : current);
}
