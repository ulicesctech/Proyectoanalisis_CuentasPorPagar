import {
  consultarRetenciones,
  RetencionesFilters,
} from './retenciones.repository';

export async function obtenerRetenciones(
  filters: RetencionesFilters,
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
    filters.idProveedor !== undefined &&
    (!Number.isInteger(filters.idProveedor) ||
      filters.idProveedor <= 0)
  ) {
    throw new Error(
      'El idProveedor debe ser un número entero positivo.',
    );
  }

  if (
    filters.idDocumento !== undefined &&
    (!Number.isInteger(filters.idDocumento) ||
      filters.idDocumento <= 0)
  ) {
    throw new Error(
      'El idDocumento debe ser un número entero positivo.',
    );
  }

  if (
    filters.idSucursal !== undefined &&
    (!Number.isInteger(filters.idSucursal) ||
      filters.idSucursal <= 0)
  ) {
    throw new Error(
      'El idSucursal debe ser un número entero positivo.',
    );
  }

  return consultarRetenciones(filters);
}