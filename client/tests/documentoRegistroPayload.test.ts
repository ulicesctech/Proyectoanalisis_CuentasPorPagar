import assert from 'node:assert/strict';
import test from 'node:test';
import { CXP_SCHEMAS, type CxpRecord } from '@erp/contracts';
import { documentoRegistroPayload } from '../src/modules/cxp/documentos/documentoRegistroPayload';
import { snapshotDocumentoDueDate } from '../../server/src/modules/cxp/services/documentos/documento.dueDate';

test('el registro no declara el plazo predeterminado del contrato al cambiar una condición de crédito', async () => {
  const conditions = new Map([[7, 15], [8, 31]]);
  const connection = {
    async execute(_sql: string, binds: { idCondicionCredito: number }) {
      const diasCredito = conditions.get(binds.idCondicionCredito);
      return { rows: diasCredito === undefined ? [] : [{ ID_CONDICION: binds.idCondicionCredito, DIAS_CREDITO: diasCredito }] };
    },
  } as unknown as Parameters<typeof snapshotDocumentoDueDate>[0];

  const input: CxpRecord = {
    idProveedor: 2, idSucursal: 3, idCondicionCredito: 7, tipoDocumento: 'FACTURA',
    origenIngreso: 'FACTURACION_ELECTRONICA', serie: 'A', numeroDocumento: '1',
    uuidFiscal: 'uuid-1', fechaDocumento: '2026-10-07', subtotal: 100, creadoPor: 4,
  };

  for (const { idCondicionCredito, fechaDocumento, fechaVencimiento, diasCredito } of [
    { idCondicionCredito: 7, fechaDocumento: '2026-10-07', fechaVencimiento: '2026-10-22', diasCredito: 15 },
    { idCondicionCredito: 8, fechaDocumento: '2026-01-20', fechaVencimiento: '2026-02-20', diasCredito: 31 },
  ]) {
    input.idCondicionCredito = idCondicionCredito;
    input.fechaDocumento = fechaDocumento;
    const validated = CXP_SCHEMAS.documentos.create.parse(input) as CxpRecord;
    assert.equal(validated.diasCredito, 0, 'el contrato agrega el cero que provocaba el rechazo');
    await assert.rejects(snapshotDocumentoDueDate(connection, validated, { diasCredito: validated.diasCredito }),
      { message: 'El vencimiento no coincide con la condición de pago' });

    const payload = documentoRegistroPayload(input, validated);
    assert.equal(Object.hasOwn(payload, 'diasCredito'), false);
    assert.equal(Object.hasOwn(payload, 'fechaVencimiento'), false);
    assert.equal(payload.idCondicionCredito, idCondicionCredito);
    const saved = await snapshotDocumentoDueDate(connection,
      CXP_SCHEMAS.documentos.create.parse(payload) as CxpRecord,
      { diasCredito: Object.hasOwn(payload, 'diasCredito') ? payload.diasCredito : undefined });
    assert.equal(saved.diasCredito, diasCredito);
    assert.equal(saved.fechaVencimiento, fechaVencimiento);
  }
});
