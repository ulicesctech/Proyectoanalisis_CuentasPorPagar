import PDFDocument from 'pdfkit';
import {
  EstadisticaComprasResult,
} from './estadistica.repository';

export function generarPdfEstadisticaCompras(
  resultado: EstadisticaComprasResult,
): Promise<Buffer> {
  return new Promise(
    (resolve, reject) => {
      const doc =
        new PDFDocument({
          margin: 40,
          size: 'A4',
        });

      const chunks: Buffer[] = [];

      doc.on(
        'data',
        (chunk) => {
          chunks.push(chunk);
        },
      );

      doc.on(
        'end',
        () => {
          resolve(
            Buffer.concat(chunks),
          );
        },
      );

      doc.on(
        'error',
        reject,
      );

      doc
        .fontSize(16)
        .text(
          'ESTADÍSTICA DE COMPRAS - RF-19',
          {
            align: 'center',
          },
        );

      doc.moveDown();

      doc
        .fontSize(10)
        .text(
          `Fecha inicial: ${resultado.fechaInicio}`,
        );

      doc.text(
        `Fecha final: ${resultado.fechaFin}`,
      );

      doc.text(
        `Agrupación: ${resultado.agrupacion}`,
      );

      doc.moveDown();

      doc
        .fontSize(12)
        .text(
          'RESUMEN',
          {
            underline: true,
          },
        );

      doc.moveDown();

      doc
        .fontSize(10)
        .text(
          `Documentos: ${resultado.totales.cantidadDocumentos}`,
        );

      doc.text(
        `Subtotal: ${resultado.totales.subtotal.toFixed(2)}`,
      );

      doc.text(
        `Impuestos: ${resultado.totales.impuestoTotal.toFixed(2)}`,
      );

      doc.text(
        `Retenciones: ${resultado.totales.retencionTotal.toFixed(2)}`,
      );

      doc.text(
        `Total neto: ${resultado.totales.totalNeto.toFixed(2)}`,
      );

      doc.text(
        `Total local: ${resultado.totales.totalLocal.toFixed(2)}`,
      );

      doc.moveDown();

      doc
        .fontSize(12)
        .text(
          'DETALLE',
          {
            underline: true,
          },
        );

      doc.moveDown();

      doc
        .fontSize(8)
        .text(
          'Grupo | Proveedor | Cantidad | Total local | Participación | Variación',
        );

      doc.moveDown(0.5);

      for (const fila of resultado.detalle) {
        doc.text(
          `${fila.periodo} | ` +
          `${fila.idProveedor ?? '-'} | ` +
          `${fila.cantidad} | ` +
          `${fila.totalLocal.toFixed(2)} | ` +
          `${fila.participacion.toFixed(2)}% | ` +
          `${fila.variacionTexto}`,
        );

        doc.moveDown(0.3);
      }

      doc.moveDown();

      doc
        .fontSize(12)
        .text(
          'PERÍODO COMPARABLE',
          {
            underline: true,
          },
        );

      doc.moveDown();

      doc
        .fontSize(9)
        .text(
          `Desde: ${resultado.periodoComparable.fechaInicio}`,
        );

      doc.text(
        `Hasta: ${resultado.periodoComparable.fechaFin}`,
      );

      doc.text(
        `Total local: ${resultado.periodoComparable.totalLocal.toFixed(2)}`,
      );

      doc.text(
        `Disponible: ${
          resultado.periodoComparable.disponible
            ? 'SI'
            : 'NO'
        }`,
      );

      doc.moveDown();

      doc
        .fontSize(12)
        .text(
          'VALIDACIÓN',
          {
            underline: true,
          },
        );

      doc.moveDown();

      doc
        .fontSize(9)
        .text(
          `Estado: ${resultado.validacion.estado}`,
        );

      for (
        const advertencia of
        resultado.validacion.advertencias
      ) {
        doc.text(
          `Advertencia: ${advertencia}`,
        );
      }

      for (
        const error of
        resultado.validacion.errores
      ) {
        doc.text(
          `Error: ${error}`,
        );
      }

      doc.end();
    },
  );
}