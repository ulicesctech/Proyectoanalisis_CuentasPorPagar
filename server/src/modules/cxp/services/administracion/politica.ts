import type {RequestHandler} from 'express';
import type {ActorProceso,CxpAdminPermisos,CxpRecord} from '@erp/contracts';
import {createHash} from 'node:crypto';
import type {Connection} from 'oracledb';
import {findUsuarioOperativoWithConnection} from '../../repositories/control/usuario.repository';
import {actorDesdeUsuario} from '../identidad';
import {CxpError} from '../errors';

/** Permisos adicionales autorizados para este proyecto; no amplían las capacidades de pagos. */
export function adminPermisos(actor:ActorProceso|null):CxpAdminPermisos{
  const active=!!actor?.roles.length,approver=active&&!!actor?.permisos.includes('APROBAR'),treasury=active&&!!actor?.permisos.includes('TESORERIA'),creator=active&&!!actor?.permisos.includes('CREAR');
  return{configuracion:approver,periodos:approver,registrarCuenta:creator,decidirCuenta:approver,registrarCompromiso:creator,elaborarConciliacion:treasury,cerrarConciliacion:treasury};
}
export async function exigirAdmin(c:Connection,actor:ActorProceso,permission:keyof CxpAdminPermisos){
  const user=await findUsuarioOperativoWithConnection(c,actor.id);
  if(!user||!adminPermisos(actorDesdeUsuario(user))[permission])throw new CxpError('Tu rol activo no permite esta operación administrativa',403);
}
export const adminVersion=(record:CxpRecord)=>createHash('sha256').update(JSON.stringify(record)).digest('hex');
export function checkAdminVersion(record:CxpRecord,version:unknown){if(typeof version!=='string'||version!==adminVersion(record))throw new CxpError('El registro cambió. Vuelve a consultarlo antes de confirmar; tus cambios no se aplicaron.',409);}
/** Los CRUD antiguos no pueden conceder estados o modificar auditoría/saldos por fuera de las operaciones. */
export const protegerCrudAdministrativo:RequestHandler=(req,_res,next)=>{
  if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
  next(new CxpError('Utiliza las acciones de la vista administrativa; la edición genérica de estados, saldos y auditoría no está disponible.',409));
};
