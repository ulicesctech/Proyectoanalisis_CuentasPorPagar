import type { ElementType, ReactNode } from 'react';
import { CalendarClock, CircleAlert, FileText, GraduationCap, ShieldCheck } from 'lucide-react';
import AuthLayout from '../../../layouts/AuthLayout';
import './auth.css';

const FEATURES = [
  { icon: FileText, title: 'Documentos y saldos', text: 'Facturas, notas y aplicaciones por proveedor.' },
  { icon: CalendarClock, title: 'Pagos programados', text: 'Contraseñas, autorizaciones y ejecución de pago.' },
  { icon: ShieldCheck, title: 'Acceso por rol', text: 'Cada usuario opera según su rol CXP asignado.' },
] as const;

const YEAR = new Date().getFullYear();

function BrandMark({ dark = false, subtitle }: { dark?: boolean; subtitle?: string }) {
  return <div className="flex items-center gap-3">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/30" aria-hidden="true">
      <GraduationCap size={22} strokeWidth={1.75} />
    </span>
    <span className="leading-tight">
      <span className={`block text-base font-semibold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>ERP Universitario</span>
      {subtitle && <span className="block text-xs font-medium text-slate-500">{subtitle}</span>}
    </span>
  </div>;
}

/** Marco común de las pantallas de acceso: panel de marca en escritorio y contenido centrado. */
export function AuthShell({ children }: { children: ReactNode }) {
  return <AuthLayout>
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <aside className="cxp-auth-brand relative hidden overflow-hidden lg:flex">
        <div className="cxp-auth-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative flex w-full flex-col justify-between gap-12 p-12 xl:p-16">
          <BrandMark dark />
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Cuentas por Pagar</p>
            <p className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-balance text-white xl:text-4xl">
              Documentos, saldos y pagos a proveedores en un solo lugar.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Registra facturas, da seguimiento a su aprobación y programa los pagos con control en cada etapa.
            </p>
            <ul className="mt-10 space-y-5">
              {FEATURES.map(({ icon: Icon, title, text }) => <li key={title} className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-blue-400 ring-1 ring-inset ring-slate-700/80" aria-hidden="true">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className="pt-0.5">
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="mt-0.5 block text-sm text-slate-400">{text}</span>
                </span>
              </li>)}
            </ul>
          </div>
          <p className="text-xs text-slate-400">© {YEAR} ERP Universitario</p>
        </div>
      </aside>
      <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-8 lg:px-12">
        <header className="lg:hidden"><BrandMark subtitle="Cuentas por Pagar" /></header>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-center text-xs text-slate-500 lg:hidden">© {YEAR} ERP Universitario</p>
      </main>
    </div>
  </AuthLayout>;
}

const TONES = {
  info: 'bg-blue-50 text-blue-600 ring-blue-100',
  danger: 'bg-red-50 text-red-600 ring-red-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
} as const;

/** Tarjeta de cada pantalla de acceso; el título es el h1 de la página. */
export function AuthCard({ title, description, icon: Icon, tone = 'info', children }: {
  title: string; description?: ReactNode; icon?: ElementType; tone?: keyof typeof TONES; children?: ReactNode;
}) {
  return <section aria-labelledby="cxp-auth-title"
    className="cxp-auth-enter rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_32px_-16px_rgb(15_23_42/0.18)] sm:p-8">
    {Icon && <span className={`mb-5 flex size-11 items-center justify-center rounded-xl ring-1 ring-inset ${TONES[tone]}`} aria-hidden="true">
      <Icon size={22} strokeWidth={1.75} />
    </span>}
    <h1 id="cxp-auth-title" className="text-2xl font-semibold tracking-tight text-balance text-slate-900">{title}</h1>
    {description && <div className="mt-2 text-sm leading-relaxed text-slate-600">{description}</div>}
    {children && <div className="mt-6">{children}</div>}
  </section>;
}

/** Error general del formulario (credenciales, límite de intentos, conexión). */
export function AuthAlert({ children }: { children: ReactNode }) {
  return <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
    <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-red-600" />
    <span className="min-w-0">{children}</span>
  </div>;
}
