// Catálogo de pantallas navegables de CXP: lo usan el buscador, las pantallas recientes y el inicio.
// Cada ruta debe existir en routes.tsx.
import {
  ArrowLeftRight, Banknote, BadgeCheck, Building2, CalendarClock, CalendarRange, ChartColumnStacked, ClipboardCheck, FilePlus2,
  FileSearch, FileText, Handshake, History, Hourglass, House, Landmark, Layers, ListOrdered, Paperclip, Percent, Receipt,
  ReceiptText, Scale, Send, ShieldCheck, SlidersHorizontal, Ticket, TrendingUp, type LucideIcon,
} from 'lucide-react';

export type GrupoPantalla =
  | 'Inicio' | 'Documentos' | 'Facturas especiales' | 'Pagos' | 'Control' | 'Conciliaciones' | 'Reportes' | 'Configuración';

export interface PantallaCxp {
  path: string;
  title: string;
  group: GrupoPantalla;
  icon: LucideIcon;
  /** Términos adicionales para el buscador. */
  keywords?: string;
}

export const CXP_PANTALLAS: PantallaCxp[] = [
  { path: '/cxp', title: 'Inicio', group: 'Inicio', icon: House, keywords: 'menu principal tablero' },

  { path: '/cxp/documentos/nuevo', title: 'Registrar documento', group: 'Documentos', icon: FilePlus2,
    keywords: 'nuevo factura registro dte proveedor' },
  { path: '/cxp/documentos', title: 'Documentos', group: 'Documentos', icon: FileText,
    keywords: 'facturas bandeja expediente validar aprobar saldo' },
  { path: '/cxp/documentos-detalle', title: 'Detalle de documentos', group: 'Documentos', icon: ListOrdered,
    keywords: 'lineas conceptos' },
  { path: '/cxp/documentos-tributos', title: 'Tributos de documentos', group: 'Documentos', icon: Receipt,
    keywords: 'impuestos iva retenciones' },

  { path: '/cxp/facturas-especiales', title: 'Facturas especiales', group: 'Facturas especiales', icon: ReceiptText,
    keywords: 'emision constancia retencion' },
  { path: '/cxp/facturas-especiales/revision', title: 'Revisión y aprobación', group: 'Facturas especiales', icon: BadgeCheck,
    keywords: 'facturas especiales aprobar revisar' },
  { path: '/cxp/reglas-tributarias', title: 'Reglas tributarias', group: 'Facturas especiales', icon: Percent,
    keywords: 'iva isr tasas' },

  { path: '/cxp/contrasenas', title: 'Contraseñas de pago', group: 'Pagos', icon: Ticket,
    keywords: 'solicitud pago contrasena' },
  { path: '/cxp/autorizaciones', title: 'Autorizaciones de pago', group: 'Pagos', icon: ShieldCheck,
    keywords: 'aprobar autorizar pago revision' },
  { path: '/cxp/pagos', title: 'Pagos', group: 'Pagos', icon: CalendarClock,
    keywords: 'programar programacion transferencia' },
  { path: '/cxp/cheques', title: 'Ejecución de pago', group: 'Pagos', icon: Send,
    keywords: 'ejecutar confirmar transferencia cheque' },
  { path: '/cxp/aplicaciones', title: 'Aplicaciones', group: 'Pagos', icon: ArrowLeftRight,
    keywords: 'aplicar pago documento saldo' },
  { path: '/cxp/lotes-pago', title: 'Lotes de pago', group: 'Pagos', icon: Layers, keywords: 'lote' },
  { path: '/cxp/pagos/registros', title: 'Registros de pago', group: 'Pagos', icon: Banknote, keywords: 'historial pagos' },

  { path: '/cxp/reglas-aprobacion', title: 'Reglas de aprobación', group: 'Control', icon: ClipboardCheck,
    keywords: 'niveles aprobador montos' },
  { path: '/cxp/aprobaciones/registros', title: 'Aprobaciones', group: 'Control', icon: BadgeCheck,
    keywords: 'historial decisiones' },
  { path: '/cxp/eventos', title: 'Eventos', group: 'Control', icon: History, keywords: 'bitacora auditoria' },
  { path: '/cxp/archivos', title: 'Archivos', group: 'Control', icon: Paperclip, keywords: 'adjuntos dte' },

  { path: '/cxp/conciliaciones-proveedor', title: 'Conciliaciones de proveedor', group: 'Conciliaciones', icon: Scale,
    keywords: 'estado de cuenta diferencias' },
  { path: '/cxp/conciliaciones-proveedor-detalle', title: 'Detalle de conciliaciones', group: 'Conciliaciones',
    icon: FileSearch, keywords: 'partidas' },
  { path: '/cxp/conciliaciones-pago', title: 'Conciliaciones de pago', group: 'Conciliaciones', icon: Landmark,
    keywords: 'bancos banco' },

  { path: '/cxp/reportes', title: 'Resumen de reportes', group: 'Reportes', icon: ChartColumnStacked,
    keywords: 'indicadores kpi' },
  { path: '/cxp/reportes/antiguedad', title: 'Antigüedad de saldos', group: 'Reportes', icon: Hourglass,
    keywords: 'vencidos vencimiento aging' },
  { path: '/cxp/reportes/retenciones', title: 'Retenciones', group: 'Reportes', icon: Receipt, keywords: 'iva isr' },
  { path: '/cxp/reportes/estadistica', title: 'Estadística de compras', group: 'Reportes', icon: TrendingUp,
    keywords: 'compras proveedores' },

  { path: '/cxp/parametros', title: 'Parámetros', group: 'Configuración', icon: SlidersHorizontal,
    keywords: 'configuracion valores' },
  { path: '/cxp/periodos', title: 'Períodos', group: 'Configuración', icon: CalendarRange,
    keywords: 'apertura cierre contable' },
  { path: '/cxp/proveedores', title: 'Proveedores', group: 'Configuración', icon: Building2, keywords: 'catalogo nit' },
  { path: '/cxp/cuentas-bancarias', title: 'Cuentas bancarias', group: 'Configuración', icon: Landmark,
    keywords: 'banco empresa' },
  { path: '/cxp/compromisos', title: 'Compromisos', group: 'Configuración', icon: Handshake, keywords: 'presupuesto' },
];

const POR_RUTA = new Map(CXP_PANTALLAS.map(pantalla => [pantalla.path, pantalla]));

/** Busca una pantalla por su ruta exacta (sin barra final). */
export function buscarPantalla(path: string): PantallaCxp | undefined {
  return POR_RUTA.get(path.length > 1 ? path.replace(/\/+$/, '') : path);
}

/** Minúsculas y sin acentos, para comparar texto escrito por el usuario. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Filtra y ordena: primero las que empiezan con la búsqueda, luego las que la contienen en el título. */
export function filtrarPantallas(consulta: string): PantallaCxp[] {
  const texto = normalizar(consulta);
  if (!texto) return CXP_PANTALLAS;
  const terminos = texto.split(/\s+/);
  return CXP_PANTALLAS
    .map((pantalla, orden) => {
      const titulo = normalizar(pantalla.title);
      const todo = `${titulo} ${normalizar(pantalla.group)} ${normalizar(pantalla.keywords ?? '')}`;
      if (!terminos.every(termino => todo.includes(termino))) return null;
      const puntaje = titulo.startsWith(texto) ? 0 : titulo.includes(texto) ? 1 : terminos.every(t => titulo.includes(t)) ? 2 : 3;
      return { pantalla, puntaje, orden };
    })
    .filter((item): item is { pantalla: PantallaCxp; puntaje: number; orden: number } => item !== null)
    .sort((a, b) => a.puntaje - b.puntaje || a.orden - b.orden)
    .map(item => item.pantalla);
}
