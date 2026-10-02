import { Router } from 'express';
import { obtenerRetenciones } from './retenciones.service';
import { generarRetencionesExcel } from './retenciones.excel';
import { generarRetencionesPdf } from './retenciones.pdf';

const router = Router();

function parseOptionalNumber(
  value: unknown,
): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error('El valor debe ser un número entero.');
  }

  return parsed;
}

function construirFiltros(query: Record<string, unknown>) {
  return {
    fechaInicio: String(query.fechaInicio ?? ''),
    fechaFin: String(query.fechaFin ?? ''),
    tipoTributo: query.tipoTributo
      ? String(query.tipoTributo)
      : undefined,
    codigoTributo: query.codigoTributo
      ? String(query.codigoTributo)
      : undefined,
    idProveedor: parseOptionalNumber(query.idProveedor),
    idDocumento: parseOptionalNumber(query.idDocumento),
    numeroConstancia: query.numeroConstancia
      ? String(query.numeroConstancia)
      : undefined,
    estado: query.estado
      ? String(query.estado)
      : undefined,
    idSucursal: parseOptionalNumber(query.idSucursal),
    moneda: query.moneda
      ? String(query.moneda)
      : undefined,
  };
}

router.get('/retenciones', async (req, res) => {
  try {
    const resultado = await obtenerRetenciones(
      construirFiltros(req.query),
    );

    return res.json({
      success: true,
      ...resultado,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Error al consultar las retenciones.',
    });
  }
});

router.get('/retenciones/exportar', async (req, res) => {
  try {
    const resultado = await obtenerRetenciones(
      construirFiltros(req.query),
    );

    const buffer = await generarRetencionesExcel(resultado);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="RF21_Retenciones.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Error al generar el Excel de retenciones.',
    });
  }
});

router.get('/retenciones/exportar-pdf', async (req, res) => {
  try {
    const resultado = await obtenerRetenciones(
      construirFiltros(req.query),
    );

    const buffer = await generarRetencionesPdf(resultado);

    res.setHeader(
      'Content-Type',
      'application/pdf',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="RF21_Retenciones.pdf"',
    );

    return res.send(buffer);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Error al generar el PDF de retenciones.',
    });
  }
});

export default router;