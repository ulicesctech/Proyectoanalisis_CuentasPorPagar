import {
  AntiguedadFilters,
  consultarAntiguedad,
} from './antiguedad.repository';

export async function obtenerAntiguedad(
  filters: AntiguedadFilters,
) {
  if (!filters.fechaCorte) {
    throw new Error('La fecha de corte es obligatoria.');
  }

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(
    filters.fechaCorte,
  );

  if (!fechaValida) {
    throw new Error(
      'La fecha de corte debe tener el formato YYYY-MM-DD.',
    );
  }

  if (
    filters.idProveedor !== undefined &&
    (!Number.isInteger(filters.idProveedor) ||
      filters.idProveedor <= 0)
  ) {
    throw new Error(
      'El idProveedor debe ser un número entero positivo.',
    );
  }

  return consultarAntiguedad(filters);
}