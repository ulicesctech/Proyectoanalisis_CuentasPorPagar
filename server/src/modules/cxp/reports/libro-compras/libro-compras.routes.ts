import { generarExcelLibroCompras } from './libro-compras.excel';
import { Request, Response, Router } from 'express';
import {
  LibroComprasFilters,
} from './libro-compras.repository';
import {
  obtenerLibroCompras,
} from './libro-compras.service';
import { generarPdfLibroCompras } from './libro-compras.pdf';
import { getConnection } from '../../../../config/database';
import { cxpEventoRepository } from '../../repositories/control/evento.repository';
import { findApprovalActor } from '../../repositories/documentos/documentoApproval.repository';
const router = Router();

/**
 * RF-18 - Generación del libro de compras
 *
 * Ejemplo:
 * GET /api/cxp/reportes/libro-compras?fechaInicio=2026-09-01&fechaFin=2026-09-30
 *
 * Filtros opcionales:
 * idProveedor
 * tipoDocumento
 * moneda
 * estado
 */
router.get(
  '/libro-compras',
  async (req: Request, res: Response) => {
    try {
const {
  fechaInicio,
  fechaFin,
  idProveedor,
  idSucursal,
  tipoDocumento,
  moneda,
  estado,
} = req.query;
      const filters: LibroComprasFilters = {
        fechaInicio: String(fechaInicio ?? ''),
        fechaFin: String(fechaFin ?? ''),
        idProveedor:
          idProveedor !== undefined
            ? Number(idProveedor)
            : undefined,
              idSucursal:
    idSucursal !== undefined
      ? Number(idSucursal)
      : undefined,
        tipoDocumento:
          tipoDocumento !== undefined
            ? String(tipoDocumento)
            : undefined,
        moneda:
          moneda !== undefined
            ? String(moneda)
            : undefined,
        estado:
          estado !== undefined
            ? String(estado)
            : undefined,
      };

      const resultado =
        await obtenerLibroCompras(filters);

      return res.json({
        success: true,
        data: resultado,
      });
    } catch (error) {
      console.error(
        '[RF-18] Error consultando libro de compras:',
        error,
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible consultar el libro de compras.',
      });
    }
  },
);

router.get(
  '/libro-compras/exportar',
  async (req: Request, res: Response) => {
    try {
      const {
        fechaInicio,
        fechaFin,
        idProveedor,
        idSucursal,
        tipoDocumento,
        moneda,
        estado,
      } = req.query;

      const filters: LibroComprasFilters = {
        fechaInicio: String(fechaInicio ?? ''),
        fechaFin: String(fechaFin ?? ''),
        idProveedor:
          idProveedor !== undefined
            ? Number(idProveedor)
            : undefined,
        idSucursal: idSucursal !== undefined ? Number(idSucursal) : undefined,
        tipoDocumento:
          tipoDocumento !== undefined
            ? String(tipoDocumento)
            : undefined,
        moneda:
          moneda !== undefined
            ? String(moneda)
            : undefined,
        estado:
          estado !== undefined
            ? String(estado)
            : undefined,
      };

      const resultado =
  await obtenerLibroCompras(filters);
      if (resultado.periodo.idPeriodo === null || resultado.validacion.estado === 'INVALIDO') {
        throw new Error('El libro requiere un período CXP y una validación sin errores para exportarse.');
      }

const archivo =
  await generarExcelLibroCompras(resultado);

// Registrar generación del libro de compras
if (resultado.periodo.idPeriodo !== null) {
  const usuarioEvento =
    req.query.usuarioEvento !== undefined
      ? Number(req.query.usuarioEvento)
      : NaN;

  if (!Number.isInteger(usuarioEvento) || usuarioEvento <= 0) {
    throw new Error(
      'El usuarioEvento debe ser un número entero positivo.',
    );
  }

  const connection = await getConnection();

 try {
  const actor = await findApprovalActor(connection, usuarioEvento);
  if (!actor?.usuarioActivo) throw new Error('El usuarioEvento debe ser un usuario activo.');
  const eventoRepository =
    cxpEventoRepository.bind(connection);

  await eventoRepository.create({
    idPeriodo: resultado.periodo.idPeriodo,
    tipoEvento: 'LIBRO_COMPRAS_GENERADO',
    asunto: `Libro de compras generado - versión ${resultado.periodo.version}`,
    detalle:
      `Libro de compras generado para el período ` +
      `${resultado.fechaInicio} al ${resultado.fechaFin}. ` +
      `Formato: XLSX.`,
    estadoAnterior: null,
    estadoNuevo: `VERSION_${resultado.periodo.version}`,
    prioridad: 'NORMAL',
    estado: 'CERRADO',
    usuarioEvento,
    fechaCierre: new Date().toISOString().replace('Z', ''),
  });

  await connection.commit();
} finally {
  await connection.close();
}
}


      const nombreArchivo =
        `Libro_Compras_${resultado.fechaInicio}_${resultado.fechaFin}.xlsx`;

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
        '[RF-18] Error exportando libro de compras:',
        error,
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible exportar el libro de compras.',
      });
    }
  },
);

router.get(
  '/libro-compras/exportar-pdf',
  async (req: Request, res: Response) => {
    try {
      const filters: LibroComprasFilters = {
        fechaInicio: String(req.query.fechaInicio ?? ''),
        fechaFin: String(req.query.fechaFin ?? ''),
        idProveedor: req.query.idProveedor
          ? Number(req.query.idProveedor)
          : undefined,

          idSucursal: req.query.idSucursal
  ? Number(req.query.idSucursal)
  : undefined,

        tipoDocumento: req.query.tipoDocumento
          ? String(req.query.tipoDocumento)
          : undefined,
        moneda: req.query.moneda
          ? String(req.query.moneda)
          : undefined,
        estado: req.query.estado
          ? String(req.query.estado)
          : undefined,
      };

      const resultado = await obtenerLibroCompras(filters);
      if (resultado.periodo.idPeriodo === null || resultado.validacion.estado === 'INVALIDO') {
        throw new Error('El libro requiere un período CXP y una validación sin errores para exportarse.');
      }
const pdf = await generarPdfLibroCompras(resultado);

// Registrar generación del libro de compras en PDF
if (resultado.periodo.idPeriodo !== null) {
  const usuarioEvento =
    req.query.usuarioEvento !== undefined
      ? Number(req.query.usuarioEvento)
      : NaN;

  if (!Number.isInteger(usuarioEvento) || usuarioEvento <= 0) {
    throw new Error(
      'El usuarioEvento debe ser un número entero positivo.',
    );
  }

  const connection = await getConnection();

  try {
    const actor = await findApprovalActor(connection, usuarioEvento);
    if (!actor?.usuarioActivo) throw new Error('El usuarioEvento debe ser un usuario activo.');
    const eventoRepository =
      cxpEventoRepository.bind(connection);

    await eventoRepository.create({
      idPeriodo: resultado.periodo.idPeriodo,
      tipoEvento: 'LIBRO_COMPRAS_GENERADO',
      asunto: `Libro de compras generado - versión ${resultado.periodo.version}`,
      detalle:
        `Libro de compras generado para el período ` +
        `${resultado.fechaInicio} al ${resultado.fechaFin}. ` +
        `Formato: PDF.`,
      estadoAnterior: null,
      estadoNuevo: `VERSION_${resultado.periodo.version}`,
      prioridad: 'NORMAL',
      estado: 'CERRADO',
      usuarioEvento,
      fechaCierre: new Date().toISOString().replace('Z', ''),
    });

    await connection.commit();
  } finally {
    await connection.close();
  }
}

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Libro_Compras_${resultado.fechaInicio}_${resultado.fechaFin}.pdf"`,
      );

      res.send(pdf);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error generando PDF';

      res.status(400).json({
        success: false,
        error: message,
      });
    }
  },
);

export default router;
