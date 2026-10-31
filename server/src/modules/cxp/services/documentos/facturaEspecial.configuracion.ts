import type { Connection } from 'oracledb';
import oracledb from 'oracledb';
import { calcularCxpFacturaEspecialSchema, cxpToday, type CxpFacturaEspecialConfiguracion } from '@erp/contracts';
import { getConnection } from '../../../../config/database';
import { reglaTributariaTx } from '../../repositories/documentos/reglaTributaria.repository';

export async function facturaEspecialConfiguracionWithConnection(connection: Connection, fechaDocumento: string, moneda: string): Promise<CxpFacturaEspecialConfiguracion> {
  const result = await connection.execute<{ GRUPO_PARAMETRO: string; CODIGO: string; VALOR_TEXTO: string | null; VALOR_NUMERO: number | null; ACTIVO: string }>(
    `SELECT GRUPO_PARAMETRO,CODIGO,VALOR_TEXTO,VALOR_NUMERO,ACTIVO FROM CXP_PARAMETRO
     WHERE GRUPO_PARAMETRO IN ('CXP_FACTURA_ESPECIAL','CXP_FE_APROBADOR_ROL')`,{}, {outFormat:oracledb.OUT_FORMAT_OBJECT});
  const rows = result.rows ?? [];
  const impedimentos: string[] = [], advertencias: string[] = [];
  const parameter = (group: string, code: string) => {
    const matches=rows.filter(p=>p.GRUPO_PARAMETRO===group && p.CODIGO===code);
    return matches.length===1 && matches[0].ACTIVO.trim()==='S' ? matches[0] : null;
  };
  const serie = parameter('CXP_FACTURA_ESPECIAL','SERIE')?.VALOR_TEXTO?.trim() || null;
  if (!serie || serie.length>40) impedimentos.push('Configura un único parámetro activo CXP_FACTURA_ESPECIAL / SERIE con texto de 1 a 40 caracteres en Parámetros. Después vuelve a comprobar; tus datos se conservarán.');
  const counter=parameter('CXP_FACTURA_ESPECIAL','CORRELATIVO_FACTURA')?.VALOR_NUMERO;
  if (counter==null || !Number.isSafeInteger(counter) || counter<0 || counter>=Number.MAX_SAFE_INTEGER) impedimentos.push('Configura CXP_FACTURA_ESPECIAL / CORRELATIVO_FACTURA activo, con el último número usado (entero no negativo). No lo reinicies.');
  if (serie && counter!=null) {
    const max = await connection.execute<{MAXIMO: number}>(`SELECT NVL(MAX(CASE WHEN REGEXP_LIKE(NUMERO_DOCUMENTO,'^[0-9]+$') THEN TO_NUMBER(NUMERO_DOCUMENTO) END),0) MAXIMO
      FROM CXP_DOCUMENTO WHERE TIPO_DOCUMENTO='FACTURA_ESPECIAL' AND SERIE=:serie`,{serie},{outFormat:oracledb.OUT_FORMAT_OBJECT});
    if (counter<Number(max.rows?.[0]?.MAXIMO ?? 0)) impedimentos.push('CORRELATIVO_FACTURA está por debajo de números ya registrados para esa serie. Revisa la configuración antes de guardar; no se asignará un número repetido.');
  }
  const constancia=parameter('CXP_FACTURA_ESPECIAL','CORRELATIVO_CONSTANCIA')?.VALOR_NUMERO;
  if (constancia==null || !Number.isSafeInteger(constancia) || constancia<0) advertencias.push('Antes de emitir configura CXP_FACTURA_ESPECIAL / CORRELATIVO_CONSTANCIA activo, conservando el último número utilizado.');
  const role=parameter('CXP_FE_APROBADOR_ROL','ROL_APROBADOR');
  if (!role?.VALOR_NUMERO || role.VALOR_TEXTO!=null) advertencias.push('Antes de aprobar configura CXP_FE_APROBADOR_ROL / ROL_APROBADOR con el ID de un rol activo en VALOR_NUMERO.');
  const rules = await reglaTributariaTx(connection).findVigentes({tipoDocumento:'FACTURA_ESPECIAL',fecha:fechaDocumento,moneda});
  if (!rules.length) advertencias.push(`No hay reglas tributarias para ${fechaDocumento} en ${moneda}. Puedes guardar en preparación, pero debes configurar las reglas antes de enviar a revisión.`);
  return {fechaDocumento,moneda,serie,puedeRegistrar:!impedimentos.length,impedimentos,advertencias,reglasVigentes:rules.length};
}
export async function facturaEspecialConfiguracion(fecha?: string, moneda?: string) {
  const input=calcularCxpFacturaEspecialSchema.pick({fechaDocumento:true,moneda:true}).parse({fechaDocumento:fecha || cxpToday(),moneda:moneda || 'GTQ'});
  const c=await getConnection();
  try { return await facturaEspecialConfiguracionWithConnection(c,input.fechaDocumento,input.moneda); } finally {await c.close();}
}
