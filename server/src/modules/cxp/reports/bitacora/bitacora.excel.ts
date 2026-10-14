import ExcelJS from 'exceljs';
import { BitacoraResult } from './bitacora.repository';

export async function generarBitacoraExcel(
  resultado: BitacoraResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'ERP Universitario';
  workbook.created = new Date();

  /*
   * HOJA 1 - RESUMEN
   */

  const resumen =
    workbook.addWorksheet('RESUMEN');

  resumen.addRow([
    'RF-22 - Bitácora de acciones críticas',
  ]);

  resumen.addRow([
    'Período',
    `${resultado.fechaInicio} a ${resultado.fechaFin}`,
  ]);

  resumen.addRow([]);

  resumen.addRow([
    'Cantidad de eventos',
    resultado.totales.cantidad,
  ]);

  resumen.getRow(1).font = {
    bold: true,
    size: 14,
  };

  resumen.getColumn(1).width = 35;
  resumen.getColumn(2).width = 30;

  /*
   * HOJA 2 - DETALLE
   */

  const detalle =
    workbook.addWorksheet('DETALLE');

  detalle.columns = [
    {
      header: 'ID Evento',
      key: 'idEvento',
      width: 12,
    },
    {
      header: 'Tipo Evento',
      key: 'tipoEvento',
      width: 25,
    },
    {
      header: 'Asunto',
      key: 'asunto',
      width: 35,
    },
    {
      header: 'Detalle',
      key: 'detalle',
      width: 50,
    },
    {
      header: 'Estado Anterior',
      key: 'estadoAnterior',
      width: 20,
    },
    {
      header: 'Estado Nuevo',
      key: 'estadoNuevo',
      width: 20,
    },
    {
      header: 'Prioridad',
      key: 'prioridad',
      width: 15,
    },
    {
      header: 'Estado',
      key: 'estado',
      width: 15,
    },
    {
      header: 'Usuario',
      key: 'usuarioEvento',
      width: 12,
    },
    {
      header: 'Fecha Evento',
      key: 'fechaEvento',
      width: 22,
    },
    {
      header: 'Fecha Cierre',
      key: 'fechaCierre',
      width: 22,
    },
    {
      header: 'ID Documento',
      key: 'idDocumento',
      width: 15,
    },
    {
      header: 'ID Pago',
      key: 'idPago',
      width: 12,
    },
    {
      header: 'ID Lote',
      key: 'idLote',
      width: 12,
    },
    {
      header: 'ID Cuenta Bancaria',
      key: 'idCuentaBancaria',
      width: 20,
    },
    {
      header: 'ID Compromiso',
      key: 'idCompromiso',
      width: 18,
    },
    {
      header: 'ID Periodo',
      key: 'idPeriodo',
      width: 15,
    },
    {
      header: 'Resultado',
      key: 'resultadoJson',
      width: 40,
    },
  ];

  for (const row of resultado.detalle) {
    detalle.addRow(row);
  }

  detalle.getRow(1).font = {
    bold: true,
  };

  detalle.autoFilter = {
    from: 'A1',
    to: 'R1',
  };

  /*
   * Exportación
   */

  const buffer =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}