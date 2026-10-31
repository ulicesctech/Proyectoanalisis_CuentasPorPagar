// Estados publicados por CXP_DOCUMENTO. Un bloqueo o vencimiento no prueba etapas anteriores.
export const documentoStage: Record<string, number | null> = {
  RECIBIDO: 0, PENDIENTE_CLASIFICACION: 0, BORRADOR: 0, PENDIENTE_REVISION: 0, EN_VALIDACION: 0,
  PENDIENTE_APROBACION: 1, APROBADA: 2,
  CONTABILIZADA: 3, PENDIENTE_PAGO: 3, PROGRAMADA_PAGO: 3,
  PARCIALMENTE_PAGADA: 3, PARCIALMENTE_APLICADA: 3, PAGADA: 3, APLICADA: 3, CERRADA: 3,
  RECHAZADA: null, ANULADA: null, DUPLICADO: null, CON_DIFERENCIAS: null,
  VENCIDA: null, BLOQUEADA: null, EN_DISPUTA: null,
};
export function documentoProgress(estado: string) {
  const current = documentoStage[estado] ?? null;
  const final = ['PAGADA', 'APLICADA', 'CERRADA'].includes(estado);
  const partial = ['PARCIALMENTE_PAGADA', 'PARCIALMENTE_APLICADA'].includes(estado);
  return { current, final, partial, steps: [
    { title: 'Recibido', hint: 'Cabecera, DTE, líneas, tributos y RF04' },
    { title: 'Pendiente de aprobación', hint: 'Esperando decisión de los aprobadores' },
    { title: 'Aprobada', hint: 'Documento autorizado' },
    { title: 'Pago o aplicación', hint: final ? 'Pago o aplicación completos' : partial ? 'Aplicación parcial; queda saldo pendiente' : 'Aplicar saldo disponible' },
  ].map((step, index) => ({ ...step, completed: current !== null && (index < current || final),
    active: current === index && !final })) };
}
