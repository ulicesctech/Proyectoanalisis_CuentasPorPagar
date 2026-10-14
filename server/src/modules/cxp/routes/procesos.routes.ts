import { consultaProcesosSchema } from '@erp/contracts';
import type { ActorProceso } from '@erp/contracts';
import { Router } from 'express';

import { getConnection } from '../../../config/database';
import { procesoStore } from '../repositories/proceso.repository';
import { CxpError } from '../services/errors';
import { requireProcessActor } from '../services/procesos/auth';
import { createPaymentWorkflow } from '../services/procesos/workflow';

const router = Router();
const workflow = createPaymentWorkflow(procesoStore);

/**
 * Lista de usuarios operativos.
 * Este endpoint debe ir ANTES de requireProcessActor porque el usuario
 * todavía no ha seleccionado "Operando como".
 */
router.get('/usuarios-operativos', async (_req, res, next) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute<{
      ID: number;
      NOMBRE: string;
      ROL_ID: number | null;
      ROL_NOMBRE: string | null;
    }>(
      `
        SELECT
          U.USU_ID_USUARIO      AS "ID",
          U.USU_NOMBRE_COMPLETO AS "NOMBRE",
          U.USU_ID_ROL          AS "ROL_ID",
          R.ROL_NOMBRE_ROL      AS "ROL_NOMBRE"
        FROM USUARIO U
        LEFT JOIN ROL R
          ON R.ROL_ID_ROL = U.USU_ID_ROL
        WHERE U.USU_ACTIVO = 1
          AND (R.ROL_ACTIVO = 1 OR R.ROL_ACTIVO IS NULL)
        ORDER BY U.USU_ID_USUARIO
      `,
    );

    const permisos: ActorProceso['permisos'] = [
      'CREAR',
      'APROBAR',
      'TESORERIA',
      'ANULAR',
    ];

    const rows = (result.rows ?? []).map(row => ({
      id: Number(row.ID),
      nombre: String(row.NOMBRE),
      roles: row.ROL_ID == null ? [] : [Number(row.ROL_ID)],
      permisos,
      rolNombre: row.ROL_NOMBRE ?? 'Sin rol',
    }));

    res.setHeader('Cache-Control', 'no-store');
    res.json(rows);
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        // La conexión ya pudo haber sido cerrada por Oracle.
      }
    }
  }
});

/**
 * A partir de aquí todas las acciones requieren el usuario seleccionado
 * mediante X-CXP-Actor-Id.
 */
router.use(requireProcessActor);

router.get('/opciones', async (req, res, next) => {
  try {
    const search =
      typeof req.query.search === 'string'
        ? req.query.search.slice(0, 80)
        : '';

    const proveedor =
      req.query.proveedor === undefined
        ? undefined
        : Number(req.query.proveedor);

    if (
      proveedor !== undefined &&
      (!Number.isSafeInteger(proveedor) || proveedor < 1)
    ) {
      throw new CxpError('Selecciona un proveedor válido', 400);
    }

    res.json(await workflow.options(search, proveedor));
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const query = consultaProcesosSchema.parse(req.query);
    res.json(
      await workflow.list(
        query.page,
        query.bandeja,
        query.estado,
      ),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Necesario para que "Ver pago" desde Aplicaciones/Lotes pueda abrir
 * directamente el proceso correcto sin enviar al CRUD histórico.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      throw new CxpError('Identificador inválido', 400);
    }

    const process = await procesoStore.transaction(async tx => {
      await tx.actorExists(res.locals.processActor);
      return tx.get(id);
    });

    res.json(process);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/cheques-disponibles', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      throw new CxpError('Identificador inválido', 400);
    }

    res.json(
      await workflow.cheques(
        id,
        res.locals.processActor,
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res
      .status(201)
      .json(
        await workflow.create(
          req.body,
          res.locals.processActor,
        ),
      );
  } catch (error) {
    next(error);
  }
});

router.post('/:id/acciones', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      throw new CxpError('Identificador inválido', 400);
    }

    res.json(
      await workflow.act(
        id,
        req.body,
        res.locals.processActor,
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.use(
  (
    error: unknown,
    _req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    if (
      [942, 904].includes(
        Number(
          (error as { errorNum?: number })
            ?.errorNum,
        ),
      )
    ) {
      res.status(503).json({
        error:
          'La estructura Oracle requerida por Procesos de pago no está instalada o no coincide.',
      });
      return;
    }

    next(error);
  },
);

export default router;
