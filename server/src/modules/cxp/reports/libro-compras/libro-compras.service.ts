import {
  LibroComprasFilters,
  consultarLibroCompras,
} from './libro-compras.repository';

export async function obtenerLibroCompras(
  filters: LibroComprasFilters,
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

  return consultarLibroCompras(filters);
}