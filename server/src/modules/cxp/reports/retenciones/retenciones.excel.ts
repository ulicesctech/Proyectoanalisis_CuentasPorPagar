import ExcelJS from 'exceljs';
import { RetencionesResult } from './retenciones.repository';

export async function generarRetencionesExcel(
  resultado: RetencionesResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'ERP Universitario';
  workbook.created = new Date();

  /*
   * HOJA 1 - RESUMEN GENERAL
   */

  const resumen = workbook.addWorksheet('RESUMEN');

  resumen.addRow([
    'RF-21 - Reporte de Retenciones ISR / IVA',
  ]);

  resumen.addRow([
    'Período',
    `${resultado.fechaInicio} a ${resultado.fechaFin}`,
  ]);

  resumen.addRow([]);

  resumen.addRow([
    'Cantidad de retenciones',
    resultado.totales.cantidad,
  ]);

  resumen.addRow([
    'Base imponible total',
    resultado.totales.baseImponible,
  ]);

  resumen.addRow([
    'Monto retenido total',
    resultado.totales.monto,
  ]);

  resumen.addRow([
    'Monto recuperable',
    resultado.totales.montoRecuperable,
  ]);

  resumen.addRow([
    'Monto no recuperable',
    resultado.totales.montoNoRecuperable,
  ]);

  resumen.getRow(1).font = {
    bold: true,
    size: 14,
  };

  resumen.getColumn(1).width = 30;
  resumen.getColumn(2).width = 25;

  /*
   * HOJA 2 - RESUMEN POR TRIBUTO
   */

  const resumenTributos =
    workbook.addWorksheet(
      'RESUMEN POR TRIBUTO',
    );

  resumenTributos.columns = [
    {
      header: 'Tipo Tributo',
      key: 'tipoTributo',
      width: 18,
    },
    {
      header: 'Código Tributo',
      key: 'codigoTributo',
      width: 18,
    },
    {
      header: 'Nombre Tributo',
      key: 'nombreTributo',
      width: 25,
    },
    {
      header: 'Cantidad',
      key: 'cantidad',
      width: 12,
    },
    {
      header: 'Base Imponible',
      key: 'baseImponible',
      width: 18,
    },
    {
      header: 'Monto',
      key: 'monto',
      width: 16,
    },
    {
      header: 'Recuperable',
      key: 'montoRecuperable',
      width: 16,
    },
    {
      header: 'No Recuperable',
      key: 'montoNoRecuperable',
      width: 18,
    },
  ];

  for (
    const row of resultado.resumenPorTributo
  ) {
    resumenTributos.addRow(row);
  }

  resumenTributos.getRow(1).font = {
    bold: true,
  };

  resumenTributos.autoFilter = {
    from: 'A1',
    to: 'H1',
  };

  /*
   * HOJA 3 - DETALLE
   */

  const detalle =
    workbook.addWorksheet('DETALLE');

  detalle.columns = [
    {
      header: 'ID Tributo',
      key: 'idTributo',
      width: 12,
    },
    {
      header: 'ID Documento',
      key: 'idDocumento',
      width: 14,
    },
    {
      header: 'Proveedor',
      key: 'idProveedor',
      width: 12,
    },
    {
      header: 'Sucursal',
      key: 'idSucursal',
      width: 12,
    },
    {
      header: 'Tipo Documento',
      key: 'tipoDocumento',
      width: 22,
    },
    {
      header: 'Número Documento',
      key: 'numeroDocumento',
      width: 20,
    },
    {
      header: 'Fecha Documento',
      key: 'fechaDocumento',
      width: 16,
    },
    {
      header: 'Moneda',
      key: 'moneda',
      width: 10,
    },
    {
      header: 'Tipo Tributo',
      key: 'tipoTributo',
      width: 16,
    },
    {
      header: 'Código Tributo',
      key: 'codigoTributo',
      width: 18,
    },
    {
      header: 'Nombre Tributo',
      key: 'nombreTributo',
      width: 24,
    },
    {
      header: 'Base Imponible',
      key: 'baseImponible',
      width: 18,
    },
    {
      header: 'Porcentaje',
      key: 'porcentaje',
      width: 14,
    },
    {
      header: 'Monto',
      key: 'monto',
      width: 16,
    },
    {
      header: 'Recuperable',
      key: 'montoRecuperable',
      width: 16,
    },
    {
      header: 'No Recuperable',
      key: 'montoNoRecuperable',
      width: 18,
    },
    {
      header: 'Constancia',
      key: 'numeroConstancia',
      width: 20,
    },
    {
      header: 'Período Fiscal',
      key: 'periodoFiscal',
      width: 16,
    },
    {
      header: 'Fecha Aplicación',
      key: 'fechaAplicacion',
      width: 18,
    },
    {
      header: 'Estado',
      key: 'estado',
      width: 16,
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
    to: 'T1',
  };

  const buffer =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}