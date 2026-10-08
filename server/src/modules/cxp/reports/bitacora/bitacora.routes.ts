import { Router } from 'express';
import { obtenerBitacora } from './bitacora.service';
import { generarBitacoraExcel } from './bitacora.excel';
import { generarBitacoraPdf } from './bitacora.pdf';

const router = Router();

function parseOptionalNumber(
  value: unknown,
): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(
      'El valor debe ser un número entero.',
    );
  }

  return parsed;
}

function construirFiltros(
  query: Record<string, unknown>,
) {
  return {
    fechaInicio: String(
      query.fechaInicio ?? '',
    ),

    fechaFin: String(
      query.fechaFin ?? '',
    ),

    usuarioEvento: parseOptionalNumber(
      query.usuarioEvento,
    ),

    tipoEvento: query.tipoEvento
      ? String(query.tipoEvento)
      : undefined,

    estado: query.estado
      ? String(query.estado)
      : undefined,

    prioridad: query.prioridad
      ? String(query.prioridad)
      : undefined,

    identificador: parseOptionalNumber(
      query.identificador,
    ),
  };
}

router.get('/bitacora', async (req, res) => {
  try {
    const resultado = await obtenerBitacora(
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
          : 'Error al consultar la bitácora.',
    });
  }
});

router.get(
  '/bitacora/exportar',
  async (req, res) => {
    try {
      const resultado = await obtenerBitacora(
        construirFiltros(req.query),
      );

      const buffer =
        await generarBitacoraExcel(resultado);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="RF22_Bitacora.xlsx"',
      );

      return res.send(buffer);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Error al generar el Excel de bitácora.',
      });
    }
  },
);

router.get(
  '/bitacora/exportar-pdf',
  async (req, res) => {
    try {
      const resultado = await obtenerBitacora(
        construirFiltros(req.query),
      );

      const buffer =
        await generarBitacoraPdf(resultado);

      res.setHeader(
        'Content-Type',
        'application/pdf',
      );

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="RF22_Bitacora.pdf"',
      );

      return res.send(buffer);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Error al generar el PDF de bitácora.',
      });
    }
  },
);

export default router;