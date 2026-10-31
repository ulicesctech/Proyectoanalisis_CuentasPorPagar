import { Router } from 'express';
import { listProveedoresCxp, createProveedorCxp, checkNitDuplicado } from '../../services/proveedor.service';
import { getConnection } from '../../../../config/database';
import { proveedorIdentidad } from '../../services/proveedor-identidad.service';
import { cxpActor } from '../../services/identidad';
import { CxpError } from '../../services/errors';

const router = Router();
router.get('/identidad', async (req,res,next) => {
  try { res.json(await proveedorIdentidad({nit:typeof req.query.nit==='string'?req.query.nit:undefined,id:typeof req.query.id==='string'?req.query.id:undefined})); }
  catch(error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const data = await listProveedoresCxp();
    res.json({ data, total: data.length });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!cxpActor(res)?.permisos.includes('CREAR')) throw new CxpError('Se requiere permiso de creación CXP para registrar proveedores',403);
    const data = await createProveedorCxp(req.body);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/validar-nit', async (req, res, next) => {
  try {
    const { nit, idProveedor } = req.body;
    const connection = await getConnection();
    try {
      await checkNitDuplicado(connection, String(nit ?? ''), idProveedor ? Number(idProveedor) : undefined);
      res.json({ valido: true, mensaje: 'NIT disponible' });
    } finally {
      await connection.close();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
