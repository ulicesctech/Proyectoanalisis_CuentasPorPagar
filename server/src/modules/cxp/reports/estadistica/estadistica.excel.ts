import ExcelJS from 'exceljs';
import { EstadisticaComprasResult } from './estadistica.repository';

export async function generarExcelEstadisticaCompras(
  resultado: EstadisticaComprasResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'ERP Universitario';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(
    'Estadística de Compras',
  );

  sheet.mergeCells('A1:J1');
  sheet.getCell('A1').value =
    'ESTADÍSTICA DE COMPRAS - RF-19';

  sheet.getCell('A2').value = 'Fecha inicial';
  sheet.getCell('B2').value =
    resultado.fechaInicio;

  sheet.getCell('D2').value = 'Fecha final';
  sheet.getCell('E2').value =
    resultado.fechaFin;

  sheet.getCell('G2').value = 'Agrupación';
  sheet.getCell('H2').value =
    resultado.agrupacion;

  sheet.getRow(4).values = [
    'Grupo',
    'Proveedor',
    'Tipo documento',
    'Moneda',
    'Cantidad',
    'Subtotal',
    'Impuestos',
    'Retenciones',
    'Total neto',
    'Total local',
  ];

  const header = sheet.getRow(4);

  header.font = {
    bold: true,
  };

  header.alignment = {
    horizontal: 'center',
  };

  for (const fila of resultado.detalle) {
    sheet.addRow([
      fila.periodo,
      fila.idProveedor ?? '',
      fila.tipoDocumento ?? '',
      fila.moneda ?? '',
      fila.cantidad,
      fila.subtotal,
      fila.impuestoTotal,
      fila.retencionTotal,
      fila.totalNeto,
      fila.totalLocal,
    ]);
  }

  const filaTotales =
    sheet.rowCount + 2;

  sheet.getCell(
    `A${filaTotales}`,
  ).value = 'TOTALES';

  sheet.getCell(
    `E${filaTotales}`,
  ).value =
    resultado.totales.cantidadDocumentos;

  sheet.getCell(
    `F${filaTotales}`,
  ).value =
    resultado.totales.subtotal;

  sheet.getCell(
    `G${filaTotales}`,
  ).value =
    resultado.totales.impuestoTotal;

  sheet.getCell(
    `H${filaTotales}`,
  ).value =
    resultado.totales.retencionTotal;

  sheet.getCell(
    `I${filaTotales}`,
  ).value =
    resultado.totales.totalNeto;

  sheet.getCell(
    `J${filaTotales}`,
  ).value =
    resultado.totales.totalLocal;

  sheet.getRow(filaTotales).font = {
    bold: true,
  };

  /*
   * Participación y variación
   */

  const filaAnalisis =
    filaTotales + 3;

  sheet.getCell(
    `A${filaAnalisis}`,
  ).value =
    'ANÁLISIS';

  sheet.getRow(filaAnalisis).font = {
    bold: true,
  };

  sheet.getRow(
    filaAnalisis + 1,
  ).values = [
    'Grupo',
    'Participación %',
    'Variación %',
    'Variación',
  ];

  sheet.getRow(
    filaAnalisis + 1,
  ).font = {
    bold: true,
  };

  resultado.detalle.forEach(
    (fila, index) => {
      sheet.getRow(
        filaAnalisis + 2 + index,
      ).values = [
        fila.periodo,
        Number(
          fila.participacion.toFixed(2),
        ),
        fila.variacion !== null
          ? Number(
              fila.variacion.toFixed(2),
            )
          : '',
        fila.variacionTexto,
      ];
    },
  );

  /*
   * Período comparable
   */

  const filaComparable =
    filaAnalisis +
    3 +
    resultado.detalle.length;

  sheet.getCell(
    `A${filaComparable}`,
  ).value =
    'PERÍODO COMPARABLE';

  sheet.getRow(
    filaComparable,
  ).font = {
    bold: true,
  };

  sheet.getCell(
    `A${filaComparable + 1}`,
  ).value =
    'Fecha inicial';

  sheet.getCell(
    `B${filaComparable + 1}`,
  ).value =
    resultado.periodoComparable
      .fechaInicio;

  sheet.getCell(
    `D${filaComparable + 1}`,
  ).value =
    'Fecha final';

  sheet.getCell(
    `E${filaComparable + 1}`,
  ).value =
    resultado.periodoComparable
      .fechaFin;

  sheet.getCell(
    `G${filaComparable + 1}`,
  ).value =
    'Total local';

  sheet.getCell(
    `H${filaComparable + 1}`,
  ).value =
    resultado.periodoComparable
      .totalLocal;

  sheet.getCell(
    `A${filaComparable + 2}`,
  ).value =
    'Disponible';

  sheet.getCell(
    `B${filaComparable + 2}`,
  ).value =
    resultado.periodoComparable
      .disponible
      ? 'SI'
      : 'NO';

  /*
   * Validación
   */

  const filaValidacion =
    filaComparable + 5;

  sheet.getCell(
    `A${filaValidacion}`,
  ).value =
    'VALIDACIÓN';

  sheet.getRow(filaValidacion).font = {
    bold: true,
  };

  sheet.getCell(
    `A${filaValidacion + 1}`,
  ).value =
    'Estado';

  sheet.getCell(
    `B${filaValidacion + 1}`,
  ).value =
    resultado.validacion.estado;

  if (
    resultado.validacion.errores
      .length > 0
  ) {
    sheet.getCell(
      `A${filaValidacion + 2}`,
    ).value = 'Errores';

    sheet.getCell(
      `B${filaValidacion + 2}`,
    ).value =
      resultado.validacion.errores.join(
        ' | ',
      );
  }

  if (
    resultado.validacion.advertencias
      .length > 0
  ) {
    sheet.getCell(
      `A${filaValidacion + 3}`,
    ).value = 'Advertencias';

    sheet.getCell(
      `B${filaValidacion + 3}`,
    ).value =
      resultado.validacion.advertencias.join(
        ' | ',
      );
  }

  /*
   * Formato
   */

  sheet.getColumn(1).width = 25;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 12;
  sheet.getColumn(6).width = 15;
  sheet.getColumn(7).width = 15;
  sheet.getColumn(8).width = 15;
  sheet.getColumn(9).width = 15;
  sheet.getColumn(10).width = 15;

  for (
    let fila = 5;
    fila <= sheet.rowCount;
    fila++
  ) {
    for (
      let columna = 6;
      columna <= 10;
      columna++
    ) {
      sheet.getCell(
        fila,
        columna,
      ).numFmt = '#,##0.00';
    }
  }

  const buffer =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}