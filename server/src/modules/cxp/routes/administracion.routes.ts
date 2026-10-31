import {Router} from 'express';
import {adminResource,adminListWithConnection,adminDetailBase,withAdminConnection} from '../services/administracion/consulta.service';
import {adminDetalle,periodoConsulta,conciliacionConsulta} from '../services/administracion/diagnosticos.service';
import {adminPermisos} from '../services/administracion/politica';
import {cxpActor} from '../services/identidad';
import {CxpError} from '../services/errors';
import {adminCreateWithConnection,adminUpdateConfigWithConnection,adminActionWithConnection,runAdminWrite} from '../services/administracion/operaciones.service';
import {prepararConciliacion,compararConciliacion,cerrarConciliacion,conciliacionSnapshot} from '../services/administracion/conciliacion.service';
const router=Router();
const actor=(res:Parameters<typeof cxpActor>[0])=>{const user=cxpActor(res);if(!user)throw new CxpError('Sesión CXP requerida',401);return user;};
router.get('/permisos',(_req,res)=>res.json(adminPermisos(cxpActor(res))));
router.get('/periodos/consulta',async(req,res,next)=>{try{res.json(await withAdminConnection(c=>periodoConsulta(c,req.query)));}catch(error){next(error);}});
router.get('/conciliaciones-proveedor/fuentes',async(req,res,next)=>{try{res.json(await withAdminConnection(c=>conciliacionConsulta(c,req.query)));}catch(error){next(error);}});
router.post('/conciliaciones-proveedor/preparar',async(req,res,next)=>{try{res.status(201).json(await runAdminWrite(c=>prepararConciliacion(c,req.body,actor(res))));}catch(error){next(error);}});
router.post('/conciliaciones-proveedor/:id/comparar',async(req,res,next)=>{try{res.json(await runAdminWrite(c=>compararConciliacion(c,Number(req.params.id),req.body,actor(res))));}catch(error){next(error);}});
router.post('/conciliaciones-proveedor/:id/cerrar',async(req,res,next)=>{try{res.json(await runAdminWrite(c=>cerrarConciliacion(c,Number(req.params.id),req.body,actor(res))));}catch(error){next(error);}});
router.get('/:resource',async(req,res,next)=>{try{
  const resource=adminResource(req.params.resource);
  const query=Object.fromEntries(Object.entries(req.query).map(([key,value])=>{if(typeof value!=='string')throw new CxpError('Los filtros deben ser texto',400);return[key,value];}));
  res.json(await withAdminConnection(c=>adminListWithConnection(c,resource,query)));
}catch(error){next(error);}});
router.get('/:resource/:id',async(req,res,next)=>{try{res.json(await withAdminConnection(async c=>{
  const resource=adminResource(req.params.resource),id=Number(req.params.id),detail=await adminDetalle(c,resource,id);
  if(resource==='conciliaciones-proveedor'){const snapshot=await conciliacionSnapshot(c,id);detail.version=snapshot.version;detail.conciliacion={lineas:snapshot.lines,moneda:snapshot.moneda,impedimentos:snapshot.impedimentos};}
  return detail;
}));}catch(error){next(error);}});
router.post('/:resource',async(req,res,next)=>{try{res.status(201).json(await runAdminWrite(c=>adminCreateWithConnection(c,adminResource(req.params.resource),req.body,actor(res))));}catch(error){next(error);}});
router.patch('/:resource/:id',async(req,res,next)=>{try{res.json(await runAdminWrite(c=>adminUpdateConfigWithConnection(c,adminResource(req.params.resource),Number(req.params.id),req.body,actor(res))));}catch(error){next(error);}});
router.post('/:resource/:id/:action',async(req,res,next)=>{try{res.json(await runAdminWrite(c=>adminActionWithConnection(c,adminResource(req.params.resource),Number(req.params.id),req.params.action,req.body,actor(res))));}catch(error){next(error);}});
export default router;
