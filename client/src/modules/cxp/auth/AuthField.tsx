import { forwardRef, useId, useState, type ElementType, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { ArrowBigUp, CircleAlert, Eye, EyeOff } from 'lucide-react';

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> & {
  label: string;
  icon?: ElementType;
  error?: string;
  helperText?: string;
  /** Solo para type="password": agrega el botón para mostrar u ocultar el valor. */
  revealable?: boolean;
};

/**
 * Campo de las pantallas de acceso. Sigue el estilo de TextInput (components/ui),
 * que es de solo lectura, y agrega lo que ese componente no permite componer:
 * `required` nativo, error asociado con aria-describedby, mostrar contraseña y aviso de Bloq Mayús.
 */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField({
  label, icon: Icon, error, helperText, revealable = false, type = 'text', required,
  onKeyDown, onKeyUp, onBlur, ...props
}, ref) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const isPassword = type === 'password';
  const canReveal = isPassword && revealable;
  const errorId = `${id}-error`, helpId = `${id}-help`, capsId = `${id}-caps`;
  const describedBy = [error ? errorId : helperText ? helpId : '', isPassword && capsLock ? capsId : '']
    .filter(Boolean).join(' ') || undefined;
  const checkCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isPassword) setCapsLock(event.getModifierState('CapsLock'));
  };

  return <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="flex items-center text-xs font-semibold text-slate-700">
      {label}
      {required && <span className="ml-0.5 text-red-500" title="Campo requerido" aria-hidden="true">*</span>}
    </label>
    <div className="relative">
      {Icon && <Icon size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
      <input
        ref={ref}
        id={id}
        type={canReveal && visible ? 'text' : type}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onKeyDown={event => { checkCapsLock(event); onKeyDown?.(event); }}
        onKeyUp={event => { checkCapsLock(event); onKeyUp?.(event); }}
        onBlur={event => { setCapsLock(false); onBlur?.(event); }}
        className={`h-10 w-full rounded-lg border bg-white text-sm text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400
          ${Icon ? 'pl-9' : 'pl-3'} ${canReveal ? 'pr-11' : 'pr-3'}
          ${error
            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : 'border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'}`}
        {...props}
      />
      {canReveal && <button
        type="button"
        onClick={() => setVisible(value => !value)}
        aria-label="Mostrar contraseña"
        aria-pressed={visible}
        aria-controls={id}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-slate-500 transition-colors duration-150 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>}
    </div>
    {error
      ? <p id={errorId} className="flex items-center gap-1 text-xs font-medium text-red-600">
        <CircleAlert size={12} aria-hidden="true" className="shrink-0" />{error}
      </p>
      : helperText && <p id={helpId} className="text-xs text-slate-500">{helperText}</p>}
    {isPassword && capsLock && <p id={capsId} className="flex items-center gap-1 text-xs font-medium text-amber-700">
      <ArrowBigUp size={12} aria-hidden="true" className="shrink-0" />Bloq Mayús está activado.
    </p>}
  </div>;
});
