import { consultaProcesosSchema } from '@erp/contracts';
import { Router } from 'express';

import { procesoStore } from '../repositories/proceso.repository';
import { CxpError } from '../services/errors';
import { exigirActor, exigirListadoUsuarios, listarUsuariosOperativos } from '../services/identidad';
import { createPaymentWorkflow } from '../services/procesos/workflow';

const router = Router();
const workflow = createPaymentWorkflow(procesoStore);

/**
 * Lista de usuarios operativos para elegir "Operando como".
 * Va antes de exigirActor porque el usuario todavía no ha elegido identidad.
 * Solo existe en el modo de identidad provisional.
 */
router.get('/usuarios-operativos', exigirListadoUsuarios, async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await listarUsuariosOperativos());
  } catch (error) {
    next(error);
  }
});

/**
 * A partir de aquí todas las acciones requieren el actor que resolvió
 * resolverActor desde X-CXP-Actor-Id.
 */
router.use(exigirActor);

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
      await tx.actorExists(res.locals.cxpActor);
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
        res.locals.cxpActor,
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
          res.locals.cxpActor,
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
        res.locals.cxpActor,
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
