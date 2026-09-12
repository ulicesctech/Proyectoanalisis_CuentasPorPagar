// client/src/shared/forms/index.ts
// Exportación de utilidades y campos de formularios

export interface ParametroFormData {
  grupoParametro: string;
  codigo: string;
  nombre: string;
  valorNumero: number | null;
  valorTexto: string | null;
  activo: boolean;
}

export interface ResultadoValidacion {
  valido: boolean;
  errores: Record<string, string>;
}

const CODIGO_REGEX = /^[A-Z0-9_]+$/;

export function validarParametro(data: ParametroFormData): ResultadoValidacion {
  const errores: Record<string, string> = {};

  if (!data.grupoParametro?.trim()) {
    errores.grupoParametro = 'El grupo de parámetro es obligatorio.';
  }

  if (!data.codigo?.trim()) {
    errores.codigo = 'El código es obligatorio.';
  } else if (!CODIGO_REGEX.test(data.codigo.trim())) {
    errores.codigo = 'Usa solo mayúsculas, números y guion bajo (_).';
  }

  if (!data.nombre?.trim()) {
    errores.nombre = 'El nombre es obligatorio.';
  }

  const tieneNumero =
    data.valorNumero !== null && data.valorNumero !== undefined && !Number.isNaN(data.valorNumero);
  const tieneTexto = !!data.valorTexto?.trim();

  if (!tieneNumero && !tieneTexto) {
    const msg = 'Debes llenar Valor número o Valor texto.';
    errores.valorNumero = msg;
    errores.valorTexto = msg;
  } else if (tieneNumero && tieneTexto) {
    const msg = 'Solo puedes llenar uno de los dos: Valor número o Valor texto.';
    errores.valorNumero = msg;
    errores.valorTexto = msg;
  }

  return { valido: Object.keys(errores).length === 0, errores };
}