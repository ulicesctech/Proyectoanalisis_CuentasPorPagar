import { Router } from 'express';
import { listProveedoresCxp, createProveedorCxp, checkNitDuplicado } from '../../services/proveedor.service';
import { getConnection } from '../../../../config/database';

const router = Router();

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
