import { Request, Response } from 'express';
import { Router } from 'express';
import {
  AntiguedadFilters,
} from './antiguedad.repository';
import { obtenerAntiguedad } from './antiguedad.service';
import { generarExcelAntiguedad } from './antiguedad.excel';
import { generarPdfAntiguedad } from './antiguedad.pdf';


const router = Router();

/**
 * RF-17 - Consulta de antigüedad de saldos
 *
 * Ejemplo:
 * GET /api/cxp/reportes/antiguedad?fechaCorte=2026-09-30
 *
 * Filtros opcionales:
 * idProveedor
 * moneda
 * estado
 * centroCosto
 */
router.get('/antiguedad', async (req: Request, res: Response) => {
  try {
const {
  fechaCorte,
  idProveedor,
  moneda,
  estado,
  centroCosto,
  clasificacion,
  rangoAntiguedad,
} = req.query;

const filters: AntiguedadFilters = {
  fechaCorte: String(fechaCorte ?? ''),
  idProveedor:
    idProveedor !== undefined
      ? Number(idProveedor)
      : undefined,
  moneda:
    moneda !== undefined
      ? String(moneda)
      : undefined,
  estado:
    estado !== undefined
      ? String(estado)
      : undefined,
  centroCosto:
    centroCosto !== undefined
      ? String(centroCosto)
      : undefined,
  clasificacion:
    clasificacion !== undefined
      ? String(clasificacion)
      : undefined,
  rangoAntiguedad:
    rangoAntiguedad !== undefined
      ? String(rangoAntiguedad)
      : undefined,
};    const resultado = await obtenerAntiguedad(filters);

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    console.error('[RF-17] Error consultando antigüedad:', error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible consultar la antigüedad de saldos.',
    });
  }
});

router.get(
  '/antiguedad/exportar',
  async (req: Request, res: Response) => {
    try {
      const {
        fechaCorte,
        idProveedor,
        moneda,
        estado,
        centroCosto,
        clasificacion,
        rangoAntiguedad,
      } = req.query;

      const filters: AntiguedadFilters = {
        fechaCorte: String(fechaCorte ?? ''),
        idProveedor:
          idProveedor !== undefined
            ? Number(idProveedor)
            : undefined,
        moneda:
          moneda !== undefined
            ? String(moneda)
            : undefined,
        estado:
          estado !== undefined
            ? String(estado)
            : undefined,
        centroCosto:
          centroCosto !== undefined
            ? String(centroCosto)
            : undefined,
        clasificacion:
          clasificacion !== undefined
            ? String(clasificacion)
            : undefined,
        rangoAntiguedad:
          rangoAntiguedad !== undefined
            ? String(rangoAntiguedad)
            : undefined,
      };

      const resultado = await obtenerAntiguedad(filters);

      const archivo = await generarExcelAntiguedad(
        resultado,
      );

      const nombreArchivo =
        `Reporte_Antiguedad_${resultado.fechaCorte}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombreArchivo}"`,
      );

      return res.send(archivo);
    } catch (error) {
      console.error(
        '[RF-17] Error exportando antigüedad:',
        error,
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible exportar la antigüedad de saldos.',
      });
    }
  },
);

router.get(
  '/antiguedad/exportar-pdf',
  async (req: Request, res: Response) => {
    try {
      const {
        fechaCorte,
        idProveedor,
        moneda,
        estado,
        centroCosto,
        clasificacion,
        rangoAntiguedad,
      } = req.query;

      const filters: AntiguedadFilters = {
        fechaCorte: String(fechaCorte ?? ''),
        idProveedor:
          idProveedor !== undefined
            ? Number(idProveedor)
            : undefined,
        moneda:
          moneda !== undefined
            ? String(moneda)
            : undefined,
        estado:
          estado !== undefined
            ? String(estado)
            : undefined,
        centroCosto:
          centroCosto !== undefined
            ? String(centroCosto)
            : undefined,
        clasificacion:
          clasificacion !== undefined
            ? String(clasificacion)
            : undefined,
        rangoAntiguedad:
          rangoAntiguedad !== undefined
            ? String(rangoAntiguedad)
            : undefined,
      };

      const resultado = await obtenerAntiguedad(filters);

      const archivo = await generarPdfAntiguedad(
        resultado,
      );

      const nombreArchivo =
        `Reporte_Antiguedad_${resultado.fechaCorte}.pdf`;

      res.setHeader(
        'Content-Type',
        'application/pdf',
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombreArchivo}"`,
      );

      return res.send(archivo);
    } catch (error) {
      console.error(
        '[RF-17] Error exportando antigüedad a PDF:',
        error,
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible exportar la antigüedad de saldos a PDF.',
      });
    }
  },
);

export default router;