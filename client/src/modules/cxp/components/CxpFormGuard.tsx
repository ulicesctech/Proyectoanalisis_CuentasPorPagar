import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBlocker } from 'react-router-dom';
import { CxpButton } from './CxpButton';

type Question = { title?: string; description?: string; stay?: string; discard?: string; disabled?: boolean };
type Pending = { dirty: boolean; busy: boolean };
type Guard = {
  confirm: (question?: Question) => Promise<boolean>;
  register: (id: string, value: Pending | null) => void;
  discard: (action: () => void, dirty?: boolean) => Promise<void>;
};
const Context = createContext<Guard | null>(null);
const exitQuestion = {
  title: '¿Salir sin guardar?',
  description: 'Tienes cambios pendientes. Si sales ahora, perderás las modificaciones que no hayas guardado',
  stay: 'Seguir editando', discard: 'Salir sin guardar',
};

/** Un solo bloqueo de navegación para todos los formularios, conceptos y archivos de CXP. */
export function CxpFormGuardProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, Pending>());
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const panel = useRef<HTMLElement>(null);
  const confirm = useCallback((next: Question = {}) => new Promise<boolean>(resolve => {
    if (resolver.current) { resolve(false); return; }
    resolver.current = resolve; setQuestion({ ...exitQuestion, ...next });
  }), []);
  const finish = useCallback((answer: boolean) => {
    const resolve = resolver.current; resolver.current = null; setQuestion(null); resolve?.(answer);
  }, []);
  const register = useCallback((id: string, value: Pending | null) => {
    if (value) entries.current.set(id, value); else entries.current.delete(id);
  }, []);
  const pending = () => [...entries.current.values()].some(value => value.dirty);
  const busy = () => [...entries.current.values()].some(value => value.busy);
  const discard = useCallback(async (action: () => void, dirty?: boolean) => {
    if (busy()) return;
    if (!(dirty ?? pending()) || await confirm()) action();
  }, [confirm]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    pending() && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let active = true;
    void confirm({ disabled: busy() }).then(answer => {
      if (active) { if (answer) blocker.proceed(); else blocker.reset(); }
    });
    return () => { active = false; };
  }, [blocker, confirm]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (pending()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('beforeunload', beforeUnload); resolver.current?.(false); resolver.current = null; };
  }, []);
  useEffect(() => {
    if (!question) return;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('[data-stay]')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(false); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      event.stopImmediatePropagation();
    };
    document.addEventListener('keydown', keyboard, true);
    return () => { document.removeEventListener('keydown', keyboard, true); document.body.style.overflow = overflow; opener?.focus(); };
  }, [question, finish]);
  return <Context.Provider value={{ confirm, register, discard }}>{children}
    {question && createPortal(<div data-cxp-confirm className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[1px]"
      onMouseDown={event => { if (event.target === event.currentTarget) finish(false); }}>
      <section ref={panel} role="alertdialog" aria-modal="true" aria-labelledby="cxp-confirm-title" aria-describedby="cxp-confirm-description"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="cxp-confirm-title" className="text-lg font-bold text-slate-900">{question.title}</h2>
        <p id="cxp-confirm-description" className="mt-2 text-sm text-slate-600">{question.description}</p>
        {question.disabled && <p role="status" className="mt-2 text-sm text-slate-600">Espera a que termine el guardado.</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <CxpButton variant="danger" disabled={question.disabled} onClick={() => finish(true)}>{question.discard}</CxpButton>
          <CxpButton data-stay onClick={() => finish(false)}>{question.stay}</CxpButton>
        </div>
      </section>
    </div>, document.body)}
  </Context.Provider>;
}

export function useCxpFormGuard() {
  const guard = useContext(Context);
  return guard ?? { confirm: async () => false, register: () => {}, discard: async (action: () => void, dirty?: boolean) => { if (!dirty) action(); } } as Guard;
}
export function useCxpPendingChanges(dirty: boolean, busy = false) {
  const { register } = useCxpFormGuard();
  const id = useId();
  useLayoutEffect(() => { register(id, { dirty, busy }); return () => register(id, null); }, [id, dirty, busy, register]);
  return useCallback(() => register(id, null), [id, register]);
}
