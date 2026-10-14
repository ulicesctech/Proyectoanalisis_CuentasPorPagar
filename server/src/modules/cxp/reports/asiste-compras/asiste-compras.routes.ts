import { Router } from 'express';
import { obtenerAsisteCompras } from './asiste-compras.service';
import { generarAsisteComprasExcel } from './asiste-compras.excel';
import { generarAsisteComprasPdf } from './asiste-compras.pdf';
import { getConnection } from '../../../../config/database';
import { cxpEventoRepository } from '../../repositories/control/evento.repository';
import { findApprovalActor } from '../../repositories/documentos/documentoApproval.repository';

const router = Router();

/**
 * Registra la generación del archivo RF-20 en CXP_EVENTO.
 */
async function registrarGeneracionRF20(
  resultado: Awaited<ReturnType<typeof obtenerAsisteCompras>>,
  fechaInicio: string,
  fechaFin: string,
  formato: 'XLSX' | 'PDF',
  usuarioEvento: number,
) {
  if (!Number.isSafeInteger(usuarioEvento) || usuarioEvento <= 0) {
    throw new Error('El usuarioEvento debe ser un número entero positivo.');
  }
  const connection = await getConnection();

  try {
    const actor = await findApprovalActor(connection, usuarioEvento);
    if (!actor?.usuarioActivo) throw new Error('El usuarioEvento debe ser un usuario activo.');
    const eventoRepository = cxpEventoRepository.bind(connection);

    await eventoRepository.create({
      tipoEvento: 'ASISTE_COMPRAS_GENERADO',
      asunto: 'Generación de archivo RF-20 Asiste Compras',
      detalle:
        `Se generó el archivo RF-20 en formato ${formato}. ` +
        `Período: ${resultado.periodo.idPeriodo ?? 'SIN_PERIODO'}. ` +
        `Versión: ${resultado.versionFormato}. ` +
        `Rango: ${fechaInicio} a ${fechaFin}. ` +
        `Documentos: ${resultado.resumen.cantidadDocumentos}.`,
      estadoAnterior: null,
      estadoNuevo: 'GENERADO',
      prioridad: 'ALTA',
      usuarioEvento,
      idDocumento: null,
      idPago: null,
      idLote: null,
      idCuentaBancaria: null,
      idCompromiso: null,
      idPeriodo: resultado.periodo.idPeriodo,
    });

    await connection.commit();
  } finally {
    await connection.close();
  }
}

/**
 * RF-20
 * Consulta y valida la información del archivo SAT/Asiste.
 */
router.get('/asiste-compras', async (req, res) => {
  try {
    const fechaInicio = String(req.query.fechaInicio ?? '');
    const fechaFin = String(req.query.fechaFin ?? '');

    const idSucursalRaw = req.query.idSucursal;
    const versionFormatoRaw = req.query.versionFormato;

    const idSucursal =
      idSucursalRaw !== undefined
        ? Number(idSucursalRaw)
        : undefined;

    const versionFormato =
      versionFormatoRaw !== undefined
        ? String(versionFormatoRaw)
        : undefined;

    const resultado = await obtenerAsisteCompras({
      fechaInicio,
      fechaFin,
      idSucursal,
      versionFormato,
    });

    return res.json(resultado);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error desconocido al consultar RF-20.';

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * RF-20
 * Genera el archivo Excel del reporte.
 */
router.get('/asiste-compras/exportar', async (req, res) => {
  try {
    const fechaInicio = String(req.query.fechaInicio ?? '');
    const fechaFin = String(req.query.fechaFin ?? '');

    const idSucursalRaw = req.query.idSucursal;
    const versionFormatoRaw = req.query.versionFormato;

    const idSucursal =
      idSucursalRaw !== undefined
        ? Number(idSucursalRaw)
        : undefined;

    const versionFormato =
      versionFormatoRaw !== undefined
        ? String(versionFormatoRaw)
        : undefined;

    const resultado = await obtenerAsisteCompras({
      fechaInicio,
      fechaFin,
      idSucursal,
      versionFormato,
    });

    if (!resultado.validacion.puedeGenerarArchivo) {
      return res.status(422).json({
        success: false,
        error:
          'El archivo no puede generarse porque existen errores de validación.',
        validacion: resultado.validacion,
      });
    }

    const buffer = await generarAsisteComprasExcel(resultado);

    await registrarGeneracionRF20(
      resultado,
      fechaInicio,
      fechaFin,
      'XLSX',
      Number(req.query.usuarioEvento),
    );

    const fechaArchivo = fechaInicio.replace(/-/g, '');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="RF20_Asiste_Compras_${fechaArchivo}.xlsx"`,
    );

    return res.send(buffer);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error desconocido al generar RF-20.';

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * RF-20
 * Genera el reporte PDF del archivo SAT/Asiste.
 */
router.get('/asiste-compras/exportar-pdf', async (req, res) => {
  try {
    const fechaInicio = String(req.query.fechaInicio ?? '');
    const fechaFin = String(req.query.fechaFin ?? '');

    const idSucursalRaw = req.query.idSucursal;
    const versionFormatoRaw = req.query.versionFormato;

    const idSucursal =
      idSucursalRaw !== undefined
        ? Number(idSucursalRaw)
        : undefined;

    const versionFormato =
      versionFormatoRaw !== undefined
        ? String(versionFormatoRaw)
        : undefined;

    const resultado = await obtenerAsisteCompras({
      fechaInicio,
      fechaFin,
      idSucursal,
      versionFormato,
    });

    if (!resultado.validacion.puedeGenerarArchivo) {
      return res.status(422).json({
        success: false,
        error:
          'El archivo no puede generarse porque existen errores de validación.',
        validacion: resultado.validacion,
      });
    }

    const buffer = await generarAsisteComprasPdf(resultado);

    await registrarGeneracionRF20(
      resultado,
      fechaInicio,
      fechaFin,
      'PDF',
      Number(req.query.usuarioEvento),
    );

    const fechaArchivo = fechaInicio.replace(/-/g, '');

    res.setHeader(
      'Content-Type',
      'application/pdf',
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="RF20_Asiste_Compras_${fechaArchivo}.pdf"`,
    );

    return res.send(buffer);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error desconocido al generar el PDF de RF-20.';

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
});

export default router;
