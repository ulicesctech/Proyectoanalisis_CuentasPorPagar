import ExcelJS from 'exceljs';
import {
  AntiguedadResult,
} from './antiguedad.repository';

export async function generarExcelAntiguedad(
  resultado: AntiguedadResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'ERP Universitario';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(
    'Antigüedad de saldos',
  );

  // Título
  worksheet.mergeCells('A1:J1');

  const titulo = worksheet.getCell('A1');

  titulo.value = 'REPORTE DE ANTIGÜEDAD DE SALDOS';
  titulo.font = {
    bold: true,
    size: 16,
  };
  titulo.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  worksheet.getRow(1).height = 25;

  // Información del reporte
  worksheet.getCell('A3').value = 'Fecha de corte';
  worksheet.getCell('B3').value = resultado.fechaCorte;

  worksheet.getCell('A4').value = 'Cantidad de documentos';
  worksheet.getCell('B4').value =
    resultado.totales.cantidadDocumentos;

  worksheet.getCell('A5').value = 'Saldo total';
  worksheet.getCell('B5').value =
    resultado.totales.saldoTotal;

  worksheet.getCell('B5').numFmt = '#,##0.00';

  // Encabezados
  const headerRow = worksheet.getRow(7);

  headerRow.values = [
    'ID Documento',
    'ID Proveedor',
    'Número Documento',
    'Tipo Documento',
    'Fecha Documento',
    'Fecha Vencimiento',
    'Moneda',
    'Total Neto',
    'Saldo Histórico',
    'Días Antigüedad',
  ];

  headerRow.font = {
    bold: true,
  };

  headerRow.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  // Detalle
  resultado.detalle.forEach((row) => {
    worksheet.addRow([
      row.idDocumento,
      row.idProveedor,
      row.numeroDocumento ?? '',
      row.tipoDocumento ?? '',
      row.fechaDocumento ?? '',
      row.fechaVencimiento ?? '',
      row.moneda ?? '',
      row.totalNeto,
      row.saldoHistorico,
      row.diasAntiguedad,
    ]);
  });

  // Formato numérico
  worksheet.getColumn(8).numFmt = '#,##0.00';
  worksheet.getColumn(9).numFmt = '#,##0.00';

  // Ancho de columnas
  worksheet.columns = [
    { width: 15 },
    { width: 15 },
    { width: 20 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 12 },
    { width: 15 },
    { width: 18 },
    { width: 18 },
  ];

  // Filtros de Excel
  worksheet.autoFilter = {
    from: 'A7',
    to: 'J7',
  };

  // Congelar encabezados
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 7,
    },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}