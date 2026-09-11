import type { ErrorRequestHandler } from 'express';
import { CxpError } from '../services/errors';

export const cxpErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof CxpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  const messages: Record<number, { status: number; message: string }> = {
    1: { status: 409, message: 'Ya existe un registro con esa combinación de datos. Revisa códigos, referencias y registros duplicados.' },
    2291: { status: 400, message: 'Uno de los registros relacionados no existe. Actualiza los catálogos y vuelve a seleccionarlo.' },
    2292: { status: 409, message: 'No se puede eliminar este registro porque otros registros lo utilizan.' },
    2290: { status: 400, message: 'Los datos no cumplen una regla de la base de datos. Revisa los importes, estados y campos relacionados.' },
    1400: { status: 400, message: 'Falta un campo obligatorio.' },
    1407: { status: 400, message: 'Un campo obligatorio no puede quedar vacío.' },
    1438: { status: 400, message: 'Un número supera la precisión de su campo.' },
    12899: { status: 400, message: 'Un texto supera la longitud permitida.' },
  };
  const mapped = messages[Number(error?.errorNum)];
  if (mapped) {
    console.error('[CXP]', error);
    res.status(mapped.status).json({ error: mapped.message });
    return;
  }
  next(error);
};
