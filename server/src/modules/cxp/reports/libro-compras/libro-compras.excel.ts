import ExcelJS from 'exceljs';

import {
  LibroComprasResult,
} from './libro-compras.repository';

export async function generarExcelLibroCompras(
  resultado: LibroComprasResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'ERP Universitario';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(
    'Libro de compras',
  );

  // Título
  worksheet.mergeCells('A1:K1');

  const titulo = worksheet.getCell('A1');

  titulo.value = 'LIBRO DE COMPRAS';
  titulo.font = {
    bold: true,
    size: 16,
  };

  titulo.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  worksheet.getRow(1).height = 25;

  // Información del período
  worksheet.getCell('A3').value = 'Fecha inicial';
  worksheet.getCell('B3').value =
    resultado.fechaInicio;

  worksheet.getCell('A4').value = 'Fecha final';
  worksheet.getCell('B4').value =
    resultado.fechaFin;

  worksheet.getCell('A5').value =
    'Cantidad de documentos';

  worksheet.getCell('B5').value =
    resultado.totales.cantidadDocumentos;

  worksheet.getCell('A6').value = 'Subtotal';

  worksheet.getCell('B6').value =
    resultado.totales.subtotal;

  worksheet.getCell('A7').value = 'Impuesto total';

  worksheet.getCell('B7').value =
    resultado.totales.impuestoTotal;

  worksheet.getCell('A8').value = 'Retención total';

  worksheet.getCell('B8').value =
    resultado.totales.retencionTotal;

  worksheet.getCell('A9').value = 'Total neto';

  worksheet.getCell('B9').value =
    resultado.totales.totalNeto;

  worksheet.getCell('A10').value = 'Total local';

  worksheet.getCell('B10').value =
    resultado.totales.totalLocal;

  // Formato de totales
  for (const row of [6, 7, 8, 9, 10]) {
    worksheet.getCell(`B${row}`).numFmt =
      '#,##0.00';
  }

  // Encabezados
  const headerRow = worksheet.getRow(12);

  headerRow.values = [
    'ID Documento',
    'ID Proveedor',
    'Tipo Documento',
    'Serie',
    'Número Documento',
    'UUID Fiscal',
    'NIT Emisor',
    'Fecha Documento',
    'Moneda',
    'Subtotal',
    'Impuesto',
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
      row.tipoDocumento ?? '',
      row.serie ?? '',
      row.numeroDocumento ?? '',
      row.uuidFiscal ?? '',
      row.nitEmisor ?? '',
      row.fechaDocumento ?? '',
      row.moneda ?? '',
      row.subtotal,
      row.impuestoTotal,
    ]);
  });

    // Detalle tributario
  if (resultado.tributos.length > 0) {
    worksheet.addRow([]);

    const tributosTitleRow = worksheet.addRow([
      'DETALLE TRIBUTARIO',
    ]);

    tributosTitleRow.font = {
      bold: true,
    };

    const tributosHeaderRow = worksheet.addRow([
      'ID Tributo',
      'ID Documento',
      'Tipo Tributo',
      'Código',
      'Nombre',
      'Base Imponible',
      'Porcentaje',
      'Monto',
      'Estado',
      'Periodo Fiscal',
    ]);

    tributosHeaderRow.font = {
      bold: true,
    };

    tributosHeaderRow.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    resultado.tributos.forEach((tributo) => {
      worksheet.addRow([
        tributo.idTributo,
        tributo.idDocumento,
        tributo.tipoTributo ?? '',
        tributo.codigoTributo ?? '',
        tributo.nombreTributo ?? '',
        tributo.baseImponible,
        tributo.porcentaje,
        tributo.monto,
        tributo.estado ?? '',
        tributo.periodoFiscal ?? '',
      ]);
    });
  }

  // Agregar columnas adicionales
  const retencionColumn = 12;
  const totalNetoColumn = 13;
  const totalLocalColumn = 14;
  const estadoColumn = 15;

  worksheet.getCell(12, retencionColumn).value =
    'Retención';

  worksheet.getCell(12, totalNetoColumn).value =
    'Total Neto';

  worksheet.getCell(12, totalLocalColumn).value =
    'Total Local';

  worksheet.getCell(12, estadoColumn).value =
    'Estado';

  worksheet.getCell(12, retencionColumn).font = {
    bold: true,
  };

  worksheet.getCell(12, totalNetoColumn).font = {
    bold: true,
  };

  worksheet.getCell(12, totalLocalColumn).font = {
    bold: true,
  };

  worksheet.getCell(12, estadoColumn).font = {
    bold: true,
  };

  resultado.detalle.forEach((row, index) => {
    const excelRow = 13 + index;

    worksheet.getCell(
      excelRow,
      retencionColumn,
    ).value = row.retencionTotal;

    worksheet.getCell(
      excelRow,
      totalNetoColumn,
    ).value = row.totalNeto;

    worksheet.getCell(
      excelRow,
      totalLocalColumn,
    ).value = row.totalLocal;

    worksheet.getCell(
      excelRow,
      estadoColumn,
    ).value = row.estado ?? '';
  });

  // Formato numérico
  for (const column of [
    10,
    11,
    12,
    13,
    14,
  ]) {
    worksheet.getColumn(column).numFmt =
      '#,##0.00';
  }

  // Ancho de columnas
  worksheet.columns = [
    { width: 15 },
    { width: 15 },
    { width: 22 },
    { width: 15 },
    { width: 22 },
    { width: 25 },
    { width: 18 },
    { width: 22 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 22 },
  ];

  // Filtros
  worksheet.autoFilter = {
    from: 'A12',
    to: 'O12',
  };

  // Congelar encabezados
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 12,
    },
  ];

  const buffer =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}