import PDFDocument from 'pdfkit';

interface AsistePdfData {
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
    subtotal: number;
    impuestoTotal: number;
    retencionTotal: number;
    totalNeto: number;
    totalLocal: number;
    estado: string | null;
    tributos: Array<{
      tipoTributo: string | null;
      codigoTributo: string | null;
      nombreTributo: string | null;
      baseImponible: number;
      porcentaje: number;
      monto: number;
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

export async function generarAsisteComprasPdf(
  data: AsistePdfData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 40,
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    /*
     * ENCABEZADO
     */
    doc
      .fontSize(18)
      .text('RF-20 - ARCHIVO SAT ASISTE COMPRAS', {
        align: 'center',
      });

    doc.moveDown();

    doc
      .fontSize(10)
      .text(`Versión del formato: ${data.versionFormato}`);

    doc.text(
      `Período: ${data.periodo.idPeriodo ?? 'No disponible'}`,
    );

    doc.text(
      `Sucursal: ${data.periodo.idSucursal ?? 'No disponible'}`,
    );

    doc.text(
      `Fecha inicial: ${data.periodo.fechaInicio ?? 'No disponible'}`,
    );

    doc.text(
      `Fecha final: ${data.periodo.fechaFin ?? 'No disponible'}`,
    );

    doc.text(
      `Estado del período: ${data.periodo.estado ?? 'No disponible'}`,
    );

    doc.moveDown();

    /*
     * RESUMEN
     */
    doc.fontSize(13).text('RESUMEN');

    doc.fontSize(10);

    doc.text(
      `Cantidad de documentos: ${data.resumen.cantidadDocumentos}`,
    );

    doc.text(
      `Total neto: Q ${data.resumen.totalNeto.toFixed(2)}`,
    );

    doc.text(
      `Total local: Q ${data.resumen.totalLocal.toFixed(2)}`,
    );

    doc.moveDown();

    /*
     * DOCUMENTOS
     */
    doc.fontSize(13).text('DOCUMENTOS');

    doc.moveDown(0.5);

    doc.fontSize(8);

    for (const documento of data.documentos) {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc
        .fontSize(10)
        .text(
          `Documento ${documento.idDocumento}`,
          {
            underline: true,
          },
        );

      doc.fontSize(8);

      doc.text(
        `Proveedor: ${documento.idProveedor ?? 'No disponible'}`,
      );

      doc.text(
        `Tipo: ${documento.tipoDocumento ?? 'No disponible'}`,
      );

      doc.text(
        `Número: ${documento.numeroDocumento ?? 'No disponible'}`,
      );

      doc.text(
        `Fecha: ${documento.fechaDocumento ?? 'No disponible'}`,
      );

      doc.text(
        `Moneda: ${documento.moneda ?? 'No disponible'}`,
      );

      doc.text(
        `Subtotal: Q ${documento.subtotal.toFixed(2)}`,
      );

      doc.text(
        `Impuestos: Q ${documento.impuestoTotal.toFixed(2)}`,
      );

      doc.text(
        `Retenciones: Q ${documento.retencionTotal.toFixed(2)}`,
      );

      doc.text(
        `Total neto: Q ${documento.totalNeto.toFixed(2)}`,
      );

      doc.text(
        `Total local: Q ${documento.totalLocal.toFixed(2)}`,
      );

      doc.text(
        `Estado: ${documento.estado ?? 'No disponible'}`,
      );

      if (documento.tributos.length > 0) {
        doc.moveDown(0.3);
        doc.text('Tributos:');

        for (const tributo of documento.tributos) {
          doc.text(
            `- ${tributo.tipoTributo ?? ''} | ` +
              `Código: ${tributo.codigoTributo ?? ''} | ` +
              `Base: Q ${tributo.baseImponible.toFixed(2)} | ` +
              `${tributo.porcentaje.toFixed(2)}% | ` +
              `Monto: Q ${tributo.monto.toFixed(2)}`,
          );
        }
      }

      doc.moveDown();
    }

    /*
     * VALIDACIÓN
     */
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.fontSize(13).text('VALIDACIÓN');

    doc.moveDown(0.5);

    doc
      .fontSize(10)
      .text(
        `Estado: ${data.validacion.estado}`,
      );

    doc.text(
      `Puede generar archivo: ${
        data.validacion.puedeGenerarArchivo
          ? 'SI'
          : 'NO'
      }`,
    );

    if (data.validacion.errores.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).text('ERRORES');

      doc.fontSize(8);

      for (const error of data.validacion.errores) {
        doc.text(`- ${error}`);
      }
    }

    if (data.validacion.advertencias.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).text('ADVERTENCIAS');

      doc.fontSize(8);

      for (const advertencia of data.validacion.advertencias) {
        doc.text(`- ${advertencia}`);
      }
    }

    doc.moveDown();

    doc
      .fontSize(7)
      .text(
        'Nota: este reporte corresponde a la implementación RF-20 del proyecto. ' +
          'La estructura oficial SAT/Asiste debe ser parametrizada y validada ' +
          'antes de declarar cumplimiento oficial con una versión específica.',
      );

    doc.end();
  });
}