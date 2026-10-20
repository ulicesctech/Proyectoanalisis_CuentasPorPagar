// client/src/modules/cxp/home/cxpHome.config.ts
// Configuración de la página de inicio de CxP: agregar o quitar submódulos aquí, sin tocar el layout.
import {
  CalendarRange, ChartColumnStacked, FileText, Gauge, Handshake, Landmark, LayoutGrid, ReceiptText, Scale, Settings2,
  SlidersHorizontal, Wallet, type LucideIcon,
} from 'lucide-react';

/**
 * Clases completas por color: Tailwind solo genera las clases que aparecen
 * literalmente en el código, por eso no se construyen dinámicamente.
 */
export const CARD_COLORS = {
  blue: {
    icon: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    link: 'text-blue-600',
    hover: 'hover:border-blue-300 hover:shadow-blue-100 focus-visible:ring-blue-500',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
    link: 'text-violet-600',
    hover: 'hover:border-violet-300 hover:shadow-violet-100 focus-visible:ring-violet-500',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    link: 'text-emerald-600',
    hover: 'hover:border-emerald-300 hover:shadow-emerald-100 focus-visible:ring-emerald-500',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
    link: 'text-amber-600',
    hover: 'hover:border-amber-300 hover:shadow-amber-100 focus-visible:ring-amber-500',
  },
  cyan: {
    icon: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white',
    link: 'text-cyan-600',
    hover: 'hover:border-cyan-300 hover:shadow-cyan-100 focus-visible:ring-cyan-500',
  },
  indigo: {
    icon: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    link: 'text-indigo-600',
    hover: 'hover:border-indigo-300 hover:shadow-indigo-100 focus-visible:ring-indigo-500',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
    link: 'text-rose-600',
    hover: 'hover:border-rose-300 hover:shadow-rose-100 focus-visible:ring-rose-500',
  },
  teal: {
    icon: 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white',
    link: 'text-teal-600',
    hover: 'hover:border-teal-300 hover:shadow-teal-100 focus-visible:ring-teal-500',
  },
  orange: {
    icon: 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white',
    link: 'text-orange-600',
    hover: 'hover:border-orange-300 hover:shadow-orange-100 focus-visible:ring-orange-500',
  },
} as const;

export type CardColor = keyof typeof CARD_COLORS;

export interface ModuleCardConfig {
  title: string;
  description: string;
  icon: LucideIcon;
  color: CardColor;
  linkText: string;
  tag: string;
  path: string;
}

export interface ModuleSectionConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Sustantivo del badge de conteo, en singular y plural. */
  countLabel: [singular: string, plural: string];
  cards: ModuleCardConfig[];
}

export const CXP_HOME_HEADER = {
  badge: 'Ciclo de Cuentas por Pagar',
  icon: Wallet,
  title: 'Módulo de Cuentas por Pagar',
  description: 'Administración integral de obligaciones con proveedores: registro de documentos, facturas especiales, '
    + 'programación de pagos, control y conciliación bancaria.',
};

export const CXP_HOME_SECTIONS: ModuleSectionConfig[] = [
  {
    id: 'operaciones',
    title: 'Operaciones y Funcionalidades',
    subtitle: 'Gestión diaria de documentos, pagos y conciliaciones',
    icon: LayoutGrid,
    countLabel: ['Operación', 'Operaciones'],
    cards: [
      { title: 'Documentos', description: 'Registro y seguimiento de documentos por pagar.', icon: FileText,
        color: 'blue', linkText: 'Ver documentos', tag: 'Transacciones', path: '/cxp/documentos' },
      { title: 'Facturas especiales', description: 'Emisión de facturas especiales y constancias de retención.',
        icon: ReceiptText, color: 'violet', linkText: 'Gestionar facturas', tag: 'Fiscal', path: '/cxp/facturas-especiales' },
      { title: 'Pagos', description: 'Programación, aprobación y emisión de pagos a proveedores.', icon: Wallet,
        color: 'emerald', linkText: 'Ver pagos', tag: 'Tesorería', path: '/cxp/contrasenas' },
      { title: 'Control', description: 'Monitoreo de saldos, vencimientos y antigüedad.', icon: Gauge,
        color: 'amber', linkText: 'Ver control', tag: 'Métricas & KPIs', path: '/cxp/reglas-aprobacion' },
      { title: 'Conciliaciones', description: 'Conciliación bancaria y resolución de diferencias.', icon: Scale,
        color: 'cyan', linkText: 'Conciliar', tag: 'Bancos', path: '/cxp/conciliaciones-proveedor' },
      { title: 'Antigüedad de saldos', description: 'Deuda vencida, rangos de vencimiento y proveedores con mayor saldo a una fecha de corte.',
        icon: ChartColumnStacked, color: 'rose', linkText: 'Ver antigüedad', tag: 'Reportes', path: '/cxp/reportes/antiguedad' },
    ],
  },
  {
    id: 'catalogos',
    title: 'Catálogos y Configuración',
    subtitle: 'Parametrización del módulo y datos de referencia',
    icon: Settings2,
    countLabel: ['Catálogo', 'Catálogos'],
    cards: [
      { title: 'Parámetros', description: 'Valores y reglas generales del módulo.', icon: SlidersHorizontal,
        color: 'indigo', linkText: 'Configurar parámetros', tag: 'Parametrización', path: '/cxp/parametros' },
      { title: 'Períodos', description: 'Apertura y cierre de períodos contables.', icon: CalendarRange,
        color: 'rose', linkText: 'Ver períodos', tag: 'Contabilidad', path: '/cxp/periodos' },
      { title: 'Cuentas bancarias', description: 'Cuentas de la empresa usadas para pagos.', icon: Landmark,
        color: 'teal', linkText: 'Gestionar cuentas', tag: 'Tesorería', path: '/cxp/cuentas-bancarias' },
      { title: 'Compromisos', description: 'Registro y control de compromisos de pago.', icon: Handshake,
        color: 'orange', linkText: 'Ver compromisos', tag: 'Finanzas', path: '/cxp/compromisos' },
    ],
  },
];
