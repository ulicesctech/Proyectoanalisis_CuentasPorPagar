import { z } from 'zod';
import { cxpDecimalFits } from './decimal';

export function cxpNumber(options: { precision?: number; scale?: number; integer?: boolean } = {}) {
  return z.number()
    .refine(value => !Number.isNaN(value), { message: 'Este campo es obligatorio' })
    .refine(value => Number.isFinite(value), { message: 'Ingresa un número válido' })
    .refine(
      value => (!options.integer || Number.isSafeInteger(value)) && cxpDecimalFits(value, options.precision, options.scale),
      { message: options.integer
        ? 'Ingresa un entero dentro del rango permitido'
        : `Número fuera de rango o con más de ${options.scale ?? 15} decimales` },
    );
}

export function cxpDate(timestamp: boolean) {
  return z.string()
    .refine(value => value !== '', { message: 'Este campo es obligatorio' })
    .refine(value => {
      const pattern = timestamp
        ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/
        : /^\d{4}-\d{2}-\d{2}$/;
      if (!pattern.test(value) || Number(value.slice(0, 4)) < 1) return false;
      const day = value.slice(0, 10);
      const date = new Date(day + 'T00:00:00.000Z');
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return false;
      return !timestamp || (Number(value.slice(11, 13)) <= 23 && Number(value.slice(14, 16)) <= 59 && Number(value.slice(17, 19) || 0) <= 59);
    }, { message: timestamp ? 'Ingresa una fecha y hora válidas' : 'Ingresa una fecha válida' });
}