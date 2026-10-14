import PDFDocument from 'pdfkit';
import { LibroComprasResult } from './libro-compras.repository';

export function generarPdfLibroCompras(
  resultado: LibroComprasResult,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: 'landscape',
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', (error) => {
      reject(error);
    });

    doc.fontSize(16)
      .text('ERP UNIVERSITARIO', { align: 'center' });

    doc.moveDown(0.5);

    doc.fontSize(13)
      .text('LIBRO DE COMPRAS', { align: 'center' });

    doc.moveDown();

    doc.fontSize(9)
      .text(`Fecha inicial: ${resultado.fechaInicio}`)
      .text(`Fecha final: ${resultado.fechaFin}`)
      .text(
        `Cantidad de documentos: ${resultado.totales.cantidadDocumentos}`,
      );

    doc.moveDown();

    doc.fontSize(9)
      .text(
        `Subtotal: ${resultado.totales.subtotal.toFixed(2)}`,
      )
      .text(
        `Impuesto: ${resultado.totales.impuestoTotal.toFixed(2)}`,
      )
      .text(
        `Retención: ${resultado.totales.retencionTotal.toFixed(2)}`,
      )
      .text(
        `Total neto: ${resultado.totales.totalNeto.toFixed(2)}`,
      )
      .text(
        `Total local: ${resultado.totales.totalLocal.toFixed(2)}`,
      );

    doc.moveDown();

    const headers = [
      'ID',
      'Proveedor',
      'Tipo',
      'Serie',
      'Número',
      'Fecha',
      'Moneda',
      'Subtotal',
      'Impuesto',
      'Retención',
      'Total',
    ];

    const xPositions = [
      40,
      65,
      115,
      185,
      225,
      290,
      375,
      420,
      480,
      540,
      610,
    ];

    doc.fontSize(7);

    headers.forEach((header, index) => {
      doc.text(header, xPositions[index], doc.y, {
        width: index === 2 ? 65 : 55,
      });
    });

    doc.moveDown();

    doc.moveTo(40, doc.y)
      .lineTo(780, doc.y)
      .stroke();

    doc.moveDown(0.5);

    for (const row of resultado.detalle) {
      if (doc.y > 520) {
        doc.addPage();

        doc.fontSize(8)
          .text('LIBRO DE COMPRAS - Continuación', {
            align: 'center',
          });

        doc.moveDown();

        doc.fontSize(7);

        headers.forEach((header, index) => {
          doc.text(header, xPositions[index], doc.y, {
            width: index === 2 ? 65 : 55,
          });
        });

        doc.moveDown();

        doc.moveTo(40, doc.y)
          .lineTo(780, doc.y)
          .stroke();

        doc.moveDown(0.5);
      }

      const fecha = row.fechaDocumento
        ? new Date(row.fechaDocumento).toLocaleDateString('es-GT')
        : '';

      const values = [
        String(row.idDocumento),
        String(row.idProveedor),
        row.tipoDocumento ?? '',
        row.serie ?? '',
        row.numeroDocumento ?? '',
        fecha,
        row.moneda ?? '',
        row.subtotal.toFixed(2),
        row.impuestoTotal.toFixed(2),
        row.retencionTotal.toFixed(2),
        row.totalNeto.toFixed(2),
      ];

      values.forEach((value, index) => {
        doc.text(value, xPositions[index], doc.y, {
          width: index === 2 ? 65 : 55,
        });
      });

      doc.moveDown(0.7);
    }

    doc.moveDown();

    doc.fontSize(9)
      .text(
        `TOTAL DOCUMENTOS: ${resultado.totales.cantidadDocumentos}`,
      )
      .text(
        `TOTAL NETO: ${resultado.totales.totalNeto.toFixed(2)}`,
      );

    doc.end();
  });
}