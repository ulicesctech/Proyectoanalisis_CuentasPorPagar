// Utilidades, helpers y tipos compartidos para el backend
import type { Router } from 'express';

const ID_PARAMS = ['id', 'idCliente', 'idCuota', 'idDetalle'];

/**
 * Rechaza con 400 cualquier parámetro de ruta de identificador que no sea un
 * entero positivo, antes de que un NaN o un texto lleguen a Oracle.
 */
export function registerIdParams(router: Router): void {
  for (const name of ID_PARAMS) {
    router.param(name, (_req, res, next, value: string) => {
      const id = Number(value);
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({ error: `El parámetro ${name} debe ser un entero positivo` });
        return;
      }
      next();
    });
  }
}
