// client/src/modules/cxp/home/cxpHome.config.ts
// Configuración de la página de inicio de CxP: áreas, accesos por rol, ciclo de pago y conteos.
// Las rutas deben existir en routes.tsx; los títulos de pantalla viven en navegacion/pantallas.ts.
import {
  BadgeCheck, CalendarClock, ChartColumnStacked, FileCheck2, FilePlus2, FileText, Gauge, Hourglass, ReceiptText, Scale,
  Send, ShieldCheck, Ticket, Wallet, Coins, type LucideIcon,
} from 'lucide-react';

/**
 * Clases completas por color: Tailwind solo genera las clases que aparecen
 * literalmente en el código, por eso no se construyen dinámicamente.
 */
export const AREA_COLORS = {
  blue: { icon: 'bg-blue-50 text-blue-600 ring-blue-100 group-hover:bg-blue-600 group-hover:text-white', border: 'hover:border-blue-200' },
  violet: { icon: 'bg-violet-50 text-violet-600 ring-violet-100 group-hover:bg-violet-600 group-hover:text-white', border: 'hover:border-violet-200' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600 ring-emerald-100 group-hover:bg-emerald-600 group-hover:text-white', border: 'hover:border-emerald-200' },
  amber: { icon: 'bg-amber-50 text-amber-600 ring-amber-100 group-hover:bg-amber-600 group-hover:text-white', border: 'hover:border-amber-200' },
  cyan: { icon: 'bg-cyan-50 text-cyan-700 ring-cyan-100 group-hover:bg-cyan-600 group-hover:text-white', border: 'hover:border-cyan-200' },
  rose: { icon: 'bg-rose-50 text-rose-600 ring-rose-100 group-hover:bg-rose-600 group-hover:text-white', border: 'hover:border-rose-200' },
} as const;

export type AreaColor = keyof typeof AREA_COLORS;

export interface AreaConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: AreaColor;
  /** Pantalla principal del área. */
  path: string;
  /** Accesos directos a sus pantallas más usadas. */
  links: { label: string; path: string }[];
}

export const CXP_AREAS: AreaConfig[] = [
  { id: 'documentos', title: 'Documentos', icon: FileText, color: 'blue', path: '/cxp/documentos',
    description: 'Registro, validación y seguimiento de los documentos por pagar.',
    links: [
      { label: 'Registrar documento', path: '/cxp/documentos/nuevo' },
      { label: 'Detalle', path: '/cxp/documentos-detalle' },
      { label: 'Tributos', path: '/cxp/documentos-tributos' },
    ] },
  { id: 'facturas-especiales', title: 'Facturas especiales', icon: ReceiptText, color: 'violet', path: '/cxp/facturas-especiales',
    description: 'Emisión de facturas especiales y constancias de retención.',
    links: [
      { label: 'Revisión y aprobación', path: '/cxp/facturas-especiales/revision' },
      { label: 'Reglas tributarias', path: '/cxp/reglas-tributarias' },
    ] },
  { id: 'pagos', title: 'Pagos', icon: Wallet, color: 'emerald', path: '/cxp/contrasenas',
    description: 'Contraseñas, autorización, programación y ejecución de pagos a proveedores.',
    links: [
      { label: 'Autorizaciones', path: '/cxp/autorizaciones' },
      { label: 'Pagos', path: '/cxp/pagos' },
      { label: 'Ejecución de pago', path: '/cxp/cheques' },
      { label: 'Aplicaciones', path: '/cxp/aplicaciones' },
    ] },
  { id: 'caja-chica', title: 'Caja Chica', icon: Coins, color: 'emerald', path: '/cxp/caja-chica',
    description: 'Apertura de fondos, registro de gastos clasificados y reposiciones de saldo.',
    links: [
      { label: 'Fondos', path: '/cxp/caja-chica?bandeja=fondos' },
      { label: 'Gastos', path: '/cxp/caja-chica?bandeja=gastos' },
      { label: 'Reposiciones', path: '/cxp/caja-chica?bandeja=reposiciones' },
    ] },
  { id: 'control', title: 'Control', icon: Gauge, color: 'amber', path: '/cxp/reglas-aprobacion',
    description: 'Reglas de aprobación, decisiones, seguimiento y evidencias.',
    links: [
      { label: 'Aprobaciones', path: '/cxp/aprobaciones/registros' },
      { label: 'Eventos', path: '/cxp/eventos' },
      { label: 'Archivos', path: '/cxp/archivos' },
    ] },
  { id: 'conciliaciones', title: 'Conciliaciones', icon: Scale, color: 'cyan', path: '/cxp/conciliaciones-proveedor',
    description: 'Estados de cuenta de proveedores y referencias de pagos.',
    links: [
      { label: 'Detalle', path: '/cxp/conciliaciones-proveedor-detalle' },
      { label: 'Conciliaciones de pago', path: '/cxp/conciliaciones-pago' },
    ] },
  { id: 'reportes', title: 'Reportes', icon: ChartColumnStacked, color: 'rose', path: '/cxp/reportes',
    description: 'Antigüedad de saldos, retenciones de IVA e ISR y estadística de compras.',
    links: [
      { label: 'Antigüedad', path: '/cxp/reportes/antiguedad' },
      { label: 'Retenciones', path: '/cxp/reportes/retenciones' },
      { label: 'Estadística', path: '/cxp/reportes/estadistica' },
    ] },
];

/** Catálogos del grupo Configuración, en el orden en que se muestran. */
export const CXP_CONFIGURACION: { path: string; description: string }[] = [
  { path: '/cxp/parametros', description: 'Valores y reglas generales' },
  { path: '/cxp/periodos', description: 'Cobertura de fechas por sucursal para programar pagos' },
  { path: '/cxp/proveedores', description: 'Catálogo de proveedores' },
  { path: '/cxp/cuentas-bancarias', description: 'Orígenes de empresa, destinos de proveedor y aprobación CXP' },
  { path: '/cxp/compromisos', description: 'Compromisos de pago' },
];

export type PasoCiclo = 'registro' | 'aprobacion' | 'contrasena' | 'autorizacion' | 'programacion' | 'ejecucion';

/** Ciclo principal de un documento hasta su pago, como lo recorre la prueba de la instalación demo. */
export const CXP_CICLO: { id: PasoCiclo; label: string; detail: string; path: string; icon: LucideIcon }[] = [
  { id: 'registro', label: 'Registro', detail: 'Documento y DTE', path: '/cxp/documentos', icon: FilePlus2 },
  { id: 'aprobacion', label: 'Aprobación', detail: 'Del documento', path: '/cxp/documentos', icon: FileCheck2 },
  { id: 'contrasena', label: 'Contraseña', detail: 'Solicitud de pago', path: '/cxp/contrasenas', icon: Ticket },
  { id: 'autorizacion', label: 'Autorización', detail: 'Del pago', path: '/cxp/autorizaciones', icon: ShieldCheck },
  { id: 'programacion', label: 'Programación', detail: 'Fecha y transferencia', path: '/cxp/pagos', icon: CalendarClock },
  { id: 'ejecucion', label: 'Ejecución', detail: 'Y confirmación', path: '/cxp/cheques', icon: Send },
];

export interface InicioPorRol {
  resumen: string;
  acciones: { label: string; path: string; icon: LucideIcon }[];
  /** Pasos del ciclo que le corresponden a este rol. */
  pasos: PasoCiclo[];
}

const INICIO_GENERAL: InicioPorRol = {
  resumen: 'Administra las obligaciones con proveedores: documentos, pagos, control y conciliación.',
  acciones: [
    { label: 'Documentos', path: '/cxp/documentos', icon: FileText },
    { label: 'Pagos', path: '/cxp/contrasenas', icon: Wallet },
    { label: 'Reportes', path: '/cxp/reportes', icon: ChartColumnStacked },
  ],
  pasos: [],
};

/** Accesos sugeridos por rol. Solo son atajos: los permisos los valida el servidor. */
const INICIO_POR_ROL: Record<string, InicioPorRol> = {
  OPERADOR_CXP: {
    resumen: 'Registra documentos de proveedores, valida sus soportes y prepara las contraseñas de pago.',
    acciones: [
      { label: 'Registrar documento', path: '/cxp/documentos/nuevo', icon: FilePlus2 },
      { label: 'Contraseñas de pago', path: '/cxp/contrasenas', icon: Ticket },
      { label: 'Documentos', path: '/cxp/documentos', icon: FileText },
    ],
    pasos: ['registro', 'contrasena'],
  },
  APROBADOR_CXP: {
    resumen: 'Revisa y aprueba documentos y autorizaciones de pago según tus reglas de aprobación.',
    acciones: [
      { label: 'Autorizaciones de pago', path: '/cxp/autorizaciones', icon: ShieldCheck },
      { label: 'Documentos', path: '/cxp/documentos', icon: FileCheck2 },
      { label: 'Facturas especiales', path: '/cxp/facturas-especiales/revision', icon: BadgeCheck },
    ],
    pasos: ['aprobacion', 'autorizacion'],
  },
  TESORERIA_CXP: {
    resumen: 'Programa, ejecuta y confirma los pagos autorizados a proveedores.',
    acciones: [
      { label: 'Programar pagos', path: '/cxp/pagos', icon: CalendarClock },
      { label: 'Ejecución de pago', path: '/cxp/cheques', icon: Send },
      { label: 'Conciliaciones de pago', path: '/cxp/conciliaciones-pago', icon: Scale },
    ],
    pasos: ['programacion', 'ejecucion'],
  },
  SUPERVISOR_CXP: {
    resumen: 'Da seguimiento al ciclo de cuentas por pagar y consulta los reportes del módulo.',
    acciones: [
      { label: 'Documentos', path: '/cxp/documentos', icon: FileText },
      { label: 'Reportes', path: '/cxp/reportes', icon: ChartColumnStacked },
      { label: 'Antigüedad de saldos', path: '/cxp/reportes/antiguedad', icon: Hourglass },
    ],
    pasos: [],
  },
};

export function inicioPorRol(rol?: string | null): InicioPorRol {
  return (rol && INICIO_POR_ROL[rol]) || INICIO_GENERAL;
}

/** Conteos del inicio: documentos por estado, con la misma consulta del listado de documentos. */
export const CXP_PENDIENTES: { estado: string; label: string; description: string; dot: string }[] = [
  { estado: 'RECIBIDO', label: 'Por validar', description: 'Registrados, esperan validación', dot: 'bg-sky-500' },
  { estado: 'PENDIENTE_APROBACION', label: 'Por aprobar', description: 'Validados, esperan aprobación', dot: 'bg-amber-500' },
  { estado: 'APROBADA', label: 'Aprobados', description: 'Listos para la contraseña de pago', dot: 'bg-emerald-500' },
  { estado: 'PARCIALMENTE_PAGADA', label: 'Pago parcial', description: 'Con saldo pendiente', dot: 'bg-violet-500' },
];
