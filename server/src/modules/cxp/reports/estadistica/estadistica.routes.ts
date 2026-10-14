import { Request, Response, Router } from 'express';
import {
  EstadisticaComprasFilters,
} from './estadistica.repository';
import {
  obtenerEstadisticaCompras,
} from './estadistica.service';

import { generarExcelEstadisticaCompras } from './estadistica.excel';
import { generarPdfEstadisticaCompras } from './estadistica.pdf';

const router = Router();

/**
 * RF-19 - Estadística de compras
 *
 * Ejemplo:
 * GET /api/cxp/reportes/estadistica?fechaInicio=2026-09-26&fechaFin=2026-09-30
 *
 * Filtros opcionales:
 * idProveedor
 * clasificacion
 * centroCosto
 * moneda
 * estado
 * agrupacion
 */

router.get(
  '/estadistica',
  async (req: Request, res: Response) => {
    try {
      const {
        fechaInicio,
        fechaFin,
        idProveedor,
        clasificacion,
        centroCosto,
        moneda,
        estado,
        agrupacion,
      } = req.query;

      const filters: EstadisticaComprasFilters = {
        fechaInicio: String(
          fechaInicio ?? '',
        ),

        fechaFin: String(
          fechaFin ?? '',
        ),

        idProveedor:
          idProveedor !== undefined
            ? Number(idProveedor)
            : undefined,

        clasificacion:
          clasificacion !== undefined
            ? String(clasificacion)
            : undefined,

        centroCosto:
          centroCosto !== undefined
            ? String(centroCosto)
            : undefined,

        moneda:
          moneda !== undefined
            ? String(moneda)
            : undefined,

        estado:
          estado !== undefined
            ? String(estado)
            : undefined,

        agrupacion:
          agrupacion !== undefined
            ? String(
                agrupacion,
              ).toUpperCase() as
                | 'PERIODO'
                | 'PROVEEDOR'
                | 'CLASIFICACION'
                | 'CENTRO_COSTO'
            : 'PERIODO',
      };

      const resultado =
        await obtenerEstadisticaCompras(
          filters,
        );

      return res.json({
        success: true,
        data: resultado,
      });
    } catch (error) {
      console.error(
        '[RF-19] Error consultando estadística:',
        error,
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible consultar la estadística de compras.',
      });
    }
  },
);

router.get(
  '/estadistica/exportar',
  async (req: Request, res: Response) => {
    try {
      const {
        fechaInicio,
        fechaFin,
        idProveedor,
        clasificacion,
        centroCosto,
        moneda,
        estado,
        agrupacion,
      } = req.query;

      const filters: EstadisticaComprasFilters = {
        fechaInicio: String(
          fechaInicio ?? '',
        ),
        fechaFin: String(
          fechaFin ?? '',
        ),
        idProveedor:
          idProveedor !== undefined
            ? Number(idProveedor)
            : undefined,
        clasificacion:
          clasificacion !== undefined
            ? String(clasificacion)
            : undefined,
        centroCosto:
          centroCosto !== undefined
            ? String(centroCosto)
            : undefined,
        moneda:
          moneda !== undefined
            ? String(moneda)
            : undefined,
        estado:
          estado !== undefined
            ? String(estado)
            : undefined,
        agrupacion:
          agrupacion !== undefined
            ? String(
                agrupacion,
              ).toUpperCase() as
                | 'PERIODO'
                | 'PROVEEDOR'
                | 'CLASIFICACION'
                | 'CENTRO_COSTO'
            : 'PERIODO',
      };

      const resultado =
        await obtenerEstadisticaCompras(
          filters,
        );

      const archivo =
        await generarExcelEstadisticaCompras(
          resultado,
        );

      const nombreArchivo =
        `Estadistica_Compras_${resultado.fechaInicio}_${resultado.fechaFin}.xlsx`;

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
        '[RF-19] Error exportando Excel:',
        error,
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible exportar la estadística.',
      });
    }
  },
);

router.get(
  '/estadistica/exportar-pdf',
  async (req: Request, res: Response) => {
    try {
      const {
        fechaInicio,
        fechaFin,
        idProveedor,
        clasificacion,
        centroCosto,
        moneda,
        estado,
        agrupacion,
      } = req.query;

      const filters: EstadisticaComprasFilters = {
        fechaInicio: String(
          fechaInicio ?? '',
        ),
        fechaFin: String(
          fechaFin ?? '',
        ),
        idProveedor:
          idProveedor !== undefined
            ? Number(idProveedor)
            : undefined,
        clasificacion:
          clasificacion !== undefined
            ? String(clasificacion)
            : undefined,
        centroCosto:
          centroCosto !== undefined
            ? String(centroCosto)
            : undefined,
        moneda:
          moneda !== undefined
            ? String(moneda)
            : undefined,
        estado:
          estado !== undefined
            ? String(estado)
            : undefined,
        agrupacion:
          agrupacion !== undefined
            ? String(
                agrupacion,
              ).toUpperCase() as
                | 'PERIODO'
                | 'PROVEEDOR'
                | 'CLASIFICACION'
                | 'CENTRO_COSTO'
            : 'PERIODO',
      };

      const resultado =
        await obtenerEstadisticaCompras(
          filters,
        );

      const archivo =
        await generarPdfEstadisticaCompras(
          resultado,
        );

      const nombreArchivo =
        `Estadistica_Compras_${resultado.fechaInicio}_${resultado.fechaFin}.pdf`;

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
        '[RF-19] Error exportando PDF:',
        error,
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible exportar la estadística.',
      });
    }
  },
);

export default router;