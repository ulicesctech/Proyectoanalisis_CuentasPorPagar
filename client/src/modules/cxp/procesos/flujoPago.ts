import type { BandejaProceso, EtapaProceso, ProcesoPago } from '@erp/contracts';

export const flowGuide = [
  { label: 'Factura', hint: 'Documento recibido', route: '/cxp/contrasenas' },
  { label: 'Constancia', hint: 'Recepción registrada', route: '/cxp/contrasenas' },
  { label: 'Solicitud', hint: 'Preparar pago', route: '/cxp/contrasenas' },
  { label: 'Autorización', hint: 'Aprobar o rechazar', route: '/cxp/autorizaciones' },
  { label: 'Programación', hint: 'Programar pago', route: '/cxp/pagos' },
  { label: 'Ejecución', hint: 'Cheque / transferencia', route: '/cxp/cheques' },
  { label: 'Aplicación', hint: 'Pago aplicado; pendiente de confirmación', route: '/cxp/cheques' },
  { label: 'Finalizado', hint: 'Pago conciliado', route: '/cxp/cheques' },
] as const;

const etapaIds = ['factura', 'constancia', 'solicitud', 'autorizacion', 'programacion',
  'ejecucion', 'aplicacion', 'finalizado'] as const;

export function rutaEtapaFlujo(index: number): string {
  return `${flowGuide[index].route}?etapa=${etapaIds[index]}`;
}

/** La URL conserva la selección aunque varias etapas compartan página. */
export function navegacionFlujo(bandeja: BandejaProceso, params: URLSearchParams) {
  const requested = etapaIds.findIndex(id => id === params.get('etapa'));
  const valid = requested >= 0 && flowGuide[requested].route === flowGuide[etapaPorBandeja[bandeja]].route;
  const vista = valid ? requested === 7 ? 'historial' : 'activos'
    : params.get('vista') === 'historial' ? 'historial' : 'activos';
  return {
    etapa: valid ? String(requested) : 'all',
    vista,
    indice: valid ? requested : vista === 'historial' ? null : etapaPorBandeja[bandeja],
  };
}

// Índices desde cero. ENTREGADO ya aplicó el pago, pero aún falta confirmar.
const etapaPorEstado: Record<EtapaProceso, number> = {
  EMITIDA: 2,
  EN_REVISION: 3,
  APROBADA: 4,
  PROGRAMADA: 5,
  CHEQUE_EMITIDO: 5,
  ENTREGADO: 6,
  COBRADO: 7,
  RECHAZADA: 3,
  ANULADA: 2,
};
const etapaPorBandeja: Record<BandejaProceso, number> = {
  contrasenas: 0, autorizaciones: 3, pagos: 4, cheques: 5,
};

export function etapaActual(proceso: Pick<ProcesoPago, 'estado'> | null, bandeja: BandejaProceso): number {
  return (proceso ? etapaPorEstado[proceso.estado] : undefined) ?? etapaPorBandeja[bandeja];
}

export function progresoFlujo(
  proceso: Pick<ProcesoPago, 'estado'> | null,
  bandeja: BandejaProceso,
  indiceNavegacion?: number | null,
) {
  const indiceActual = proceso || indiceNavegacion === undefined ? etapaActual(proceso, bandeja) : indiceNavegacion;
  const finalizado = proceso?.estado === 'COBRADO';
  return flowGuide.map((step, index) => ({
    ...step,
    numero: index + 1,
    actual: index === indiceActual,
    estado: proceso && (index < indiceActual || finalizado)
      ? 'completado' as const
      : index === indiceActual ? 'actual' as const : 'pendiente' as const,
  }));
}
