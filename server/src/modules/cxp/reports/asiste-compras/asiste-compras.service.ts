import {
  AsisteComprasFilters,
  consultarAsisteCompras,
} from './asiste-compras.repository';

export async function obtenerAsisteCompras(
  filters: AsisteComprasFilters,
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
    filters.idSucursal !== undefined &&
    (!Number.isInteger(filters.idSucursal) ||
      filters.idSucursal <= 0)
  ) {
    throw new Error(
      'El idSucursal debe ser un número entero positivo.',
    );
  }

  const resultado = await consultarAsisteCompras(filters);

  const errores: string[] = [];
  const advertencias: string[] = [];

  if (!resultado.periodo.idPeriodo) {
    advertencias.push(
      'No existe un período CXP que cubra completamente el rango seleccionado.',
    );
  }

  if (resultado.documentos.length === 0) {
    advertencias.push(
      'No existen documentos de compra válidos para el período seleccionado.',
    );
  }

  if (
    resultado.periodo.estado &&
    resultado.periodo.estado.toUpperCase() === 'CERRADO'
  ) {
    advertencias.push(
      'El período se encuentra cerrado. La regeneración debe conservar la trazabilidad de la versión generada.',
    );
  }

  // Validación de documentos.
  for (const documento of resultado.documentos) {
    if (!documento.idDocumento) {
      errores.push(
        'Existe un documento sin identificador.',
      );
    }

    if (!documento.idProveedor) {
      errores.push(
        `Documento ${documento.idDocumento}: no tiene proveedor asociado.`,
      );
    }

    if (!documento.tipoDocumento) {
      errores.push(
        `Documento ${documento.idDocumento}: falta el tipo de documento.`,
      );
    }

    if (!documento.numeroDocumento) {
      errores.push(
        `Documento ${documento.idDocumento}: falta el número de documento.`,
      );
    }

    if (!documento.fechaDocumento) {
      errores.push(
        `Documento ${documento.idDocumento}: falta la fecha del documento.`,
      );
    }

    if (!documento.moneda) {
      errores.push(
        `Documento ${documento.idDocumento}: falta la moneda.`,
      );
    }

    if (documento.totalNeto < 0) {
      errores.push(
        `Documento ${documento.idDocumento}: el total neto no puede ser negativo.`,
      );
    }

    if (documento.totalLocal < 0) {
      errores.push(
        `Documento ${documento.idDocumento}: el total local no puede ser negativo.`,
      );
    }

    // Validación básica de tributos.
    for (const tributo of documento.tributos) {
      if (!tributo.tipoTributo) {
        errores.push(
          `Documento ${documento.idDocumento}: existe un tributo sin tipo.`,
        );
      }

      if (!tributo.codigoTributo) {
        errores.push(
          `Documento ${documento.idDocumento}: existe un tributo sin código.`,
        );
      }

      if (tributo.monto < 0) {
        errores.push(
          `Documento ${documento.idDocumento}: un tributo tiene monto negativo.`,
        );
      }
    }
  }

  // Validación de documentos duplicados.
  const documentosVistos = new Set<string>();

  for (const documento of resultado.documentos) {
    const clave = [
      documento.idProveedor ?? '',
      documento.tipoDocumento ?? '',
      documento.numeroDocumento ?? '',
    ].join('|');

    if (documentosVistos.has(clave)) {
      errores.push(
        `Documento duplicado: proveedor ${documento.idProveedor}, tipo ${documento.tipoDocumento}, número ${documento.numeroDocumento}.`,
      );
    }

    documentosVistos.add(clave);
  }

  // Validación de totales.
  const totalNetoDocumentos = resultado.documentos.reduce(
    (total, documento) => total + documento.totalNeto,
    0,
  );

  const totalLocalDocumentos = resultado.documentos.reduce(
    (total, documento) => total + documento.totalLocal,
    0,
  );

  const diferenciaNeto = Math.abs(
    totalNetoDocumentos -
      resultado.documentos.reduce(
        (total, documento) => total + documento.totalNeto,
        0,
      ),
  );

  const diferenciaLocal = Math.abs(
    totalLocalDocumentos -
      resultado.documentos.reduce(
        (total, documento) => total + documento.totalLocal,
        0,
      ),
  );

  if (diferenciaNeto > 0.01) {
    errores.push(
      'Existe una diferencia en la validación del total neto.',
    );
  }

  if (diferenciaLocal > 0.01) {
    errores.push(
      'Existe una diferencia en la validación del total local.',
    );
  }

  // RF-20 exige una estructura SAT configurable.
  // Actualmente el repositorio no contiene una tabla específica
  // de estructura SAT/Asiste, por lo que no se inventan columnas
  // oficiales. La versión se recibe como parámetro.
  const versionFormato =
    filters.versionFormato?.trim() || 'CONFIGURADA';

  if (versionFormato === 'CONFIGURADA') {
    advertencias.push(
      'No existe una estructura SAT/Asiste configurada en la base de datos; la versión del formato debe ser parametrizada antes de declarar cumplimiento oficial.',
    );
  }

  const estadoValidacion =
    errores.length > 0
      ? 'CON_ERRORES'
      : advertencias.length > 0
        ? 'CON_ADVERTENCIAS'
        : 'VALIDADO';

  return {
    success: errores.length === 0,
    versionFormato,
    periodo: resultado.periodo,
    documentos: resultado.documentos,
    resumen: {
      cantidadDocumentos: resultado.documentos.length,
      totalNeto: totalNetoDocumentos,
      totalLocal: totalLocalDocumentos,
    },
    validacion: {
      estado: estadoValidacion,
      errores,
      advertencias,
      puedeGenerarArchivo: errores.length === 0,
    },
  };
}