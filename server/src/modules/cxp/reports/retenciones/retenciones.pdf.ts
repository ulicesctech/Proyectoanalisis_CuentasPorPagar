import PDFDocument from 'pdfkit';
import { RetencionesResult } from './retenciones.repository';

export async function generarRetencionesPdf(
  resultado: RetencionesResult,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc
      .fontSize(16)
      .text('RF-21 - Reporte de Retenciones ISR / IVA', {
        align: 'center',
      });

    doc.moveDown();

    doc
      .fontSize(10)
      .text(
        `Período: ${resultado.fechaInicio} a ${resultado.fechaFin}`,
      );

    doc.moveDown();

    doc.text(
      `Cantidad de retenciones: ${resultado.totales.cantidad}`,
    );

    doc.text(
      `Base imponible total: ${resultado.totales.baseImponible.toFixed(2)}`,
    );

    doc.text(
      `Monto retenido total: ${resultado.totales.monto.toFixed(2)}`,
    );

    doc.text(
      `Monto recuperable: ${resultado.totales.montoRecuperable.toFixed(2)}`,
    );

    doc.text(
      `Monto no recuperable: ${resultado.totales.montoNoRecuperable.toFixed(2)}`,
    );

    doc.moveDown();

    doc.fontSize(12).text('Detalle de retenciones');

    doc.moveDown();

    doc.fontSize(8);

    for (const row of resultado.detalle) {
      if (doc.y > 730) {
        doc.addPage();
        doc.fontSize(8);
      }

      doc.text(
        `Tributo #${row.idTributo} | Documento #${row.idDocumento} | ` +
          `${row.tipoDocumento ?? 'SIN_TIPO'} | ` +
          `Código: ${row.codigoTributo ?? 'SIN_CODIGO'}`,
      );

      doc.text(
        `Base: ${row.baseImponible.toFixed(2)} | ` +
          `Tasa: ${row.porcentaje}% | ` +
          `Monto: ${row.monto.toFixed(2)} | ` +
          `Estado: ${row.estado ?? 'SIN_ESTADO'}`,
      );

      doc.text(
        `Constancia: ${row.numeroConstancia ?? 'SIN_CONSTANCIA'} | ` +
          `Período fiscal: ${row.periodoFiscal ?? 'SIN_PERIODO'}`,
      );

      doc.moveDown(0.5);
    }

    doc.end();
  });
}