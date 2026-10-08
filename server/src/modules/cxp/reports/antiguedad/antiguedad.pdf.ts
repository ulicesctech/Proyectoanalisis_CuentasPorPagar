import PDFDocument from 'pdfkit';
import {
  AntiguedadResult,
} from './antiguedad.repository';

export async function generarPdfAntiguedad(
  resultado: AntiguedadResult,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
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

    // Título
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('REPORTE DE ANTIGÜEDAD DE SALDOS', {
        align: 'center',
      });

    doc.moveDown();

    // Información general
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Fecha de corte: ${resultado.fechaCorte}`);

    doc.text(
      `Cantidad de documentos: ${resultado.totales.cantidadDocumentos}`,
    );

    doc.text(
      `Saldo total: ${resultado.totales.saldoTotal.toFixed(2)}`,
    );

    doc.moveDown();

    // Encabezado de tabla
    doc
      .font('Helvetica-Bold')
      .fontSize(8);

    doc.text(
      'ID',
      40,
      doc.y,
      { width: 35 },
    );

    doc.text(
      'Documento',
      75,
      doc.y,
      { width: 90 },
    );

    doc.text(
      'Tipo',
      165,
      doc.y,
      { width: 65 },
    );

    doc.text(
      'Vencimiento',
      230,
      doc.y,
      { width: 75 },
    );

    doc.text(
      'Saldo',
      305,
      doc.y,
      { width: 65 },
    );

    doc.text(
      'Días',
      370,
      doc.y,
      { width: 45 },
    );

    doc.text(
      'Rango',
      415,
      doc.y,
      { width: 100 },
    );

    doc.moveDown(1);

    // Detalle
    doc.font('Helvetica');

    resultado.detalle.forEach((row) => {
      // Nueva página si ya no hay espacio
      if (doc.y > 730) {
        doc.addPage();

        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .text('ID', 40, doc.y, { width: 35 })
          .text('Documento', 75, doc.y, { width: 90 })
          .text('Tipo', 165, doc.y, { width: 65 })
          .text('Vencimiento', 230, doc.y, { width: 75 })
          .text('Saldo', 305, doc.y, { width: 65 })
          .text('Días', 370, doc.y, { width: 45 })
          .text('Rango', 415, doc.y, { width: 100 });

        doc.moveDown(1);
        doc.font('Helvetica');
      }

      const y = doc.y;

      doc.text(
        String(row.idDocumento),
        40,
        y,
        { width: 35 },
      );

      doc.text(
        row.numeroDocumento ?? '',
        75,
        y,
        { width: 90 },
      );

      doc.text(
        row.tipoDocumento ?? '',
        165,
        y,
        { width: 65 },
      );

      doc.text(
        row.fechaVencimiento
          ? row.fechaVencimiento.substring(0, 10)
          : 'Sin vencimiento',
        230,
        y,
        { width: 75 },
      );

      doc.text(
        row.saldoHistorico.toFixed(2),
        305,
        y,
        { width: 65 },
      );

      doc.text(
        String(row.diasAntiguedad),
        370,
        y,
        { width: 45 },
      );

      doc.text(
        row.rangoAntiguedad,
        415,
        y,
        { width: 100 },
      );

      doc.moveDown(1.5);
    });

    doc.end();
  });
}