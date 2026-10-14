import ExcelJS from 'exceljs';

interface AsisteExcelData {
  versionFormato: string;
  periodo: {
    idPeriodo: number | null;
    idSucursal: number | null;
    estado: string | null;
    fechaInicio: string | null;
    fechaFin: string | null;
  };
  documentos: Array<{
    idDocumento: number;
    idProveedor: number | null;
    tipoDocumento: string | null;
    numeroDocumento: string | null;
    fechaDocumento: string | null;
    moneda: string | null;
    tipoCambio: number | null;
    subtotal: number;
    impuestoTotal: number;
    retencionTotal: number;
    totalNeto: number;
    totalLocal: number;
    estado: string | null;
    centroCosto: string | null;
    tributos: Array<{
      tipoTributo: string | null;
      codigoTributo: string | null;
      nombreTributo: string | null;
      baseImponible: number;
      porcentaje: number;
      monto: number;
      numeroConstancia: string | null;
      periodoFiscal: string | null;
      fechaAplicacion: string | null;
      estado: string | null;
    }>;
  }>;
  resumen: {
    cantidadDocumentos: number;
    totalNeto: number;
    totalLocal: number;
  };
  validacion: {
    estado: string;
    errores: string[];
    advertencias: string[];
    puedeGenerarArchivo: boolean;
  };
}

export async function generarAsisteComprasExcel(
  data: AsisteExcelData,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'ERP Cuentas por Pagar';
  workbook.created = new Date();
  workbook.modified = new Date();

  /*
   * HOJA 1: INFORMACIÓN DEL ARCHIVO
   */
  const infoSheet = workbook.addWorksheet('INFORMACION');

  infoSheet.columns = [
    { header: 'Campo', key: 'campo', width: 30 },
    { header: 'Valor', key: 'valor', width: 55 },
  ];

  infoSheet.addRows([
    {
      campo: 'RF',
      valor: 'RF-20 - Archivo SAT Asiste Compras',
    },
    {
      campo: 'Versión del formato',
      valor: data.versionFormato,
    },
    {
      campo: 'ID período',
      valor: data.periodo.idPeriodo ?? '',
    },
    {
      campo: 'Sucursal',
      valor: data.periodo.idSucursal ?? '',
    },
    {
      campo: 'Estado del período',
      valor: data.periodo.estado ?? '',
    },
    {
      campo: 'Fecha inicial',
      valor: data.periodo.fechaInicio ?? '',
    },
    {
      campo: 'Fecha final',
      valor: data.periodo.fechaFin ?? '',
    },
    {
      campo: 'Cantidad de documentos',
      valor: data.resumen.cantidadDocumentos,
    },
    {
      campo: 'Total neto',
      valor: data.resumen.totalNeto,
    },
    {
      campo: 'Total local',
      valor: data.resumen.totalLocal,
    },
    {
      campo: 'Estado de validación',
      valor: data.validacion.estado,
    },
    {
      campo: 'Puede generar archivo',
      valor: data.validacion.puedeGenerarArchivo
        ? 'SI'
        : 'NO',
    },
  ]);

  /*
   * HOJA 2: DOCUMENTOS
   */
  const documentosSheet = workbook.addWorksheet('DOCUMENTOS');

  documentosSheet.columns = [
    { header: 'ID DOCUMENTO', key: 'idDocumento', width: 16 },
    { header: 'ID PROVEEDOR', key: 'idProveedor', width: 16 },
    { header: 'TIPO DOCUMENTO', key: 'tipoDocumento', width: 24 },
    { header: 'NUMERO DOCUMENTO', key: 'numeroDocumento', width: 22 },
    { header: 'FECHA DOCUMENTO', key: 'fechaDocumento', width: 18 },
    { header: 'MONEDA', key: 'moneda', width: 12 },
    { header: 'TIPO CAMBIO', key: 'tipoCambio', width: 14 },
    { header: 'SUBTOTAL', key: 'subtotal', width: 15 },
    { header: 'IMPUESTO', key: 'impuestoTotal', width: 15 },
    { header: 'RETENCION', key: 'retencionTotal', width: 15 },
    { header: 'TOTAL NETO', key: 'totalNeto', width: 15 },
    { header: 'TOTAL LOCAL', key: 'totalLocal', width: 15 },
    { header: 'ESTADO', key: 'estado', width: 22 },
    { header: 'CENTRO COSTO', key: 'centroCosto', width: 18 },
  ];

  for (const documento of data.documentos) {
    documentosSheet.addRow({
      idDocumento: documento.idDocumento,
      idProveedor: documento.idProveedor ?? '',
      tipoDocumento: documento.tipoDocumento ?? '',
      numeroDocumento: documento.numeroDocumento ?? '',
      fechaDocumento: documento.fechaDocumento ?? '',
      moneda: documento.moneda ?? '',
      tipoCambio: documento.tipoCambio ?? '',
      subtotal: documento.subtotal,
      impuestoTotal: documento.impuestoTotal,
      retencionTotal: documento.retencionTotal,
      totalNeto: documento.totalNeto,
      totalLocal: documento.totalLocal,
      estado: documento.estado ?? '',
      centroCosto: documento.centroCosto ?? '',
    });
  }

  /*
   * HOJA 3: TRIBUTOS
   */
  const tributosSheet = workbook.addWorksheet('TRIBUTOS');

  tributosSheet.columns = [
    { header: 'ID DOCUMENTO', key: 'idDocumento', width: 16 },
    { header: 'TIPO TRIBUTO', key: 'tipoTributo', width: 18 },
    { header: 'CODIGO TRIBUTO', key: 'codigoTributo', width: 18 },
    { header: 'NOMBRE TRIBUTO', key: 'nombreTributo', width: 25 },
    { header: 'BASE IMPONIBLE', key: 'baseImponible', width: 18 },
    { header: 'PORCENTAJE', key: 'porcentaje', width: 15 },
    { header: 'MONTO', key: 'monto', width: 15 },
    { header: 'NUMERO CONSTANCIA', key: 'numeroConstancia', width: 22 },
    { header: 'PERIODO FISCAL', key: 'periodoFiscal', width: 18 },
    { header: 'FECHA APLICACION', key: 'fechaAplicacion', width: 20 },
    { header: 'ESTADO', key: 'estado', width: 18 },
  ];

  for (const documento of data.documentos) {
    for (const tributo of documento.tributos) {
      tributosSheet.addRow({
        idDocumento: documento.idDocumento,
        tipoTributo: tributo.tipoTributo ?? '',
        codigoTributo: tributo.codigoTributo ?? '',
        nombreTributo: tributo.nombreTributo ?? '',
        baseImponible: tributo.baseImponible,
        porcentaje: tributo.porcentaje,
        monto: tributo.monto,
        numeroConstancia: tributo.numeroConstancia ?? '',
        periodoFiscal: tributo.periodoFiscal ?? '',
        fechaAplicacion: tributo.fechaAplicacion ?? '',
        estado: tributo.estado ?? '',
      });
    }
  }

  /*
   * HOJA 4: VALIDACION
   */
  const validacionSheet = workbook.addWorksheet('VALIDACION');

  validacionSheet.columns = [
    { header: 'TIPO', key: 'tipo', width: 20 },
    { header: 'MENSAJE', key: 'mensaje', width: 100 },
  ];

  for (const error of data.validacion.errores) {
    validacionSheet.addRow({
      tipo: 'ERROR',
      mensaje: error,
    });
  }

  for (const advertencia of data.validacion.advertencias) {
    validacionSheet.addRow({
      tipo: 'ADVERTENCIA',
      mensaje: advertencia,
    });
  }

  if (
    data.validacion.errores.length === 0 &&
    data.validacion.advertencias.length === 0
  ) {
    validacionSheet.addRow({
      tipo: 'OK',
      mensaje: 'No se encontraron errores ni advertencias.',
    });
  }

  /*
   * FORMATO DE LAS HOJAS
   */
  for (const sheet of workbook.worksheets) {
    const header = sheet.getRow(1);

    header.font = {
      bold: true,
    };

    header.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    header.height = 25;

    sheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    sheet.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },
      to: {
        row: 1,
        column: sheet.columnCount,
      },
    };
  }

  /*
   * Formato numérico
   */
  for (const row of documentosSheet.getRows(2, documentosSheet.rowCount - 1) ?? []) {
    row.getCell('H').numFmt = '#,##0.00';
    row.getCell('I').numFmt = '#,##0.00';
    row.getCell('J').numFmt = '#,##0.00';
    row.getCell('K').numFmt = '#,##0.00';
    row.getCell('L').numFmt = '#,##0.00';
  }

  for (const row of tributosSheet.getRows(2, tributosSheet.rowCount - 1) ?? []) {
    row.getCell('E').numFmt = '#,##0.00';
    row.getCell('F').numFmt = '0.00';
    row.getCell('G').numFmt = '#,##0.00';
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}