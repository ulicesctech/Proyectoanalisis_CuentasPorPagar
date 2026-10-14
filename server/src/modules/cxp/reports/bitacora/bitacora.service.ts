import {
  consultarBitacora,
  BitacoraFilters,
} from './bitacora.repository';

export async function obtenerBitacora(
  filters: BitacoraFilters,
) {
  if (!filters.fechaInicio || !filters.fechaFin) {
    throw new Error(
      'La fecha inicial y la fecha final son obligatorias.',
    );
  }

  const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (
    !fechaRegex.test(filters.fechaInicio) ||
    !fechaRegex.test(filters.fechaFin)
  ) {
    throw new Error(
      'Las fechas deben tener el formato YYYY-MM-DD.',
    );
  }

  if (filters.fechaInicio > filters.fechaFin) {
    throw new Error(
      'La fecha inicial no puede ser mayor que la fecha final.',
    );
  }

  if (
    filters.usuarioEvento !== undefined &&
    (!Number.isInteger(filters.usuarioEvento) ||
      filters.usuarioEvento <= 0)
  ) {
    throw new Error(
      'El usuarioEvento debe ser un número entero positivo.',
    );
  }

  if (
    filters.identificador !== undefined &&
    (!Number.isInteger(filters.identificador) ||
      filters.identificador <= 0)
  ) {
    throw new Error(
      'El identificador debe ser un número entero positivo.',
    );
  }

  return consultarBitacora(filters);
}