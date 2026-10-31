import oracledb, {type Connection} from 'oracledb';
import type { CxpTributosOpciones } from '@erp/contracts';
import { getConnection } from '../../../../config/database';
import { createCxpRepository } from '../../repositories/crud.repository';
import { reglaTributariaTx } from '../../repositories/documentos/reglaTributaria.repository';
import { CxpError } from '../errors';

export async function documentoTributoOpcionesWithConnection(connection: Connection, id: number): Promise<CxpTributosOpciones> {
  if(!Number.isSafeInteger(id)||id<1)throw new CxpError('Documento inválido',400);
  const doc=await createCxpRepository('documentos').bind(connection).findById(id);
  if(!doc)throw new CxpError('Documento no encontrado',404);
  const history=await connection.execute<{TIPO:string;CODIGO:string;NOMBRE:string}>(
    `SELECT DISTINCT T.TIPO_TRIBUTO TIPO,T.CODIGO_TRIBUTO CODIGO,T.NOMBRE_TRIBUTO NOMBRE
     FROM CXP_DOCUMENTO_TRIBUTO T JOIN CXP_DOCUMENTO D ON D.ID_DOCUMENTO=T.ID_DOCUMENTO
     WHERE D.TIPO_DOCUMENTO=:tipo ORDER BY T.CODIGO_TRIBUTO,T.NOMBRE_TRIBUTO,T.TIPO_TRIBUTO FETCH FIRST 50 ROWS ONLY`,
    {tipo:doc.tipoDocumento},{outFormat:oracledb.OUT_FORMAT_OBJECT});
  const reglas=await reglaTributariaTx(connection).findVigentes({tipoDocumento:String(doc.tipoDocumento),fecha:String(doc.fechaDocumento).slice(0,10),moneda:String(doc.moneda)});
  return {identificaciones:[...(history.rows??[]).map(row=>({tipo:row.TIPO,codigo:row.CODIGO,nombre:row.NOMBRE,origen:'HISTORICO' as const})),
    ...reglas.map(row=>({tipo:row.tipoTributo,codigo:row.codigoTributo,nombre:row.nombreTributo,origen:'CONFIGURACION' as const}))],reglas};
}
export async function documentoTributoOpciones(id:number){const connection=await getConnection();try{return await documentoTributoOpcionesWithConnection(connection,id);}finally{await connection.close();}}
