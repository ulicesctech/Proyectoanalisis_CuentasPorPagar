import type { ButtonHTMLAttributes, ElementType } from 'react';
import { Button as SharedButton } from '../../../shared/ui-kit';
import './CxpButton.css';

export interface CxpButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ElementType;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

/** Conserva el comportamiento del botón compartido y aplica el acabado visual de Pagos. */
export function CxpButton({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: CxpButtonProps) {
  return <SharedButton
    {...props}
    variant={variant}
    size={size}
    className={`cxp-button cxp-button--${variant} cxp-button--${size} ${className}`}
  />;
}
