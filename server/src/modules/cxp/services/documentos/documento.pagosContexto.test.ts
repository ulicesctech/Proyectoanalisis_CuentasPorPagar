import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { documentoPagosContextoWithConnection } from './documento.pagosContexto';

test('el contexto distingue una reserva CP del saldo reutilizable ordinario',async()=>{
  const c={execute:async(sql:string)=>{
    if(sql.includes('FROM CXP_DOCUMENTO'))return{rows:[{ID_DOCUMENTO:10,ID_PROVEEDOR:1,MONEDA:'GTQ',NATURALEZA:'D',ESTADO:'APROBADA',SALDO_PENDIENTE:605}]};
    if(sql.includes('GROUP BY P.ID_PAGO'))return{rows:[{ID_PAGO:8,CODIGO_PAGO:'CP-00000008',ESTADO:'PROGRAMADO',MONTO_OBLIGACION:605,MONTO_NO_APLICADO:605,RESERVADO:605,APLICADO:0}]};
    if(sql.includes('NVL(SUM'))return{rows:[{RESERVADO:605}]};
    if(sql.includes('COUNT(*) TOTAL'))return{rows:[{TOTAL:0,CON_SALDO:0,ELEGIBLES:0}]};
    throw Error(sql);
  }} as unknown as Connection;
  const context=await documentoPagosContextoWithConnection(c,10);
  assert.equal(context.ordinariosDisponibles,0);assert.equal(context.reservadoDocumento,605);assert.equal(context.procesos[0].saldoSinAplicar,605);
  assert.ok(context.motivos.some(m=>m.includes('reservado')));
});
