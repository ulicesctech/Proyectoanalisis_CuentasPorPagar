import PDFDocument from 'pdfkit';
import { BitacoraResult } from './bitacora.repository';

export async function generarBitacoraPdf(
  resultado: BitacoraResult,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) =>
      chunks.push(chunk),
    );

    doc.on('end', () =>
      resolve(Buffer.concat(chunks)),
    );

    doc.on('error', reject);

    doc
      .fontSize(16)
      .text(
        'RF-22 - Bitácora de acciones críticas',
        {
          align: 'center',
        },
      );

    doc.moveDown();

    doc
      .fontSize(10)
      .text(
        `Período: ${resultado.fechaInicio} a ${resultado.fechaFin}`,
      );

    doc.moveDown();

    doc.text(
      `Cantidad de eventos: ${resultado.totales.cantidad}`,
    );

    doc.moveDown();

    doc
      .fontSize(12)
      .text('Detalle de eventos');

    doc.moveDown();

    doc.fontSize(8);

    for (const row of resultado.detalle) {
      if (doc.y > 700) {
        doc.addPage();
        doc.fontSize(8);
      }

      doc.text(
        `Evento #${row.idEvento} | ` +
          `Tipo: ${row.tipoEvento ?? 'SIN_TIPO'} | ` +
          `Usuario: ${row.usuarioEvento}`,
      );

      doc.text(
        `Fecha: ${row.fechaEvento ?? 'SIN_FECHA'} | ` +
          `Prioridad: ${row.prioridad ?? 'SIN_PRIORIDAD'} | ` +
          `Estado: ${row.estado ?? 'SIN_ESTADO'}`,
      );

      doc.text(
        `Asunto: ${row.asunto ?? 'SIN_ASUNTO'}`,
      );

      if (row.detalle) {
        doc.text(
          `Detalle: ${row.detalle}`,
        );
      }

      doc.text(
        `Estado anterior: ${
          row.estadoAnterior ?? 'SIN_ESTADO'
        } | Estado nuevo: ${
          row.estadoNuevo ?? 'SIN_ESTADO'
        }`,
      );

      doc.text(
        `Documento: ${
          row.idDocumento ?? 'N/A'
        } | Pago: ${
          row.idPago ?? 'N/A'
        } | Lote: ${
          row.idLote ?? 'N/A'
        }`,
      );

      doc.text(
        `Cuenta bancaria: ${
          row.idCuentaBancaria ?? 'N/A'
        } | Compromiso: ${
          row.idCompromiso ?? 'N/A'
        } | Periodo: ${
          row.idPeriodo ?? 'N/A'
        }`,
      );

      doc.moveDown(0.8);
    }

    doc.end();
  });
}