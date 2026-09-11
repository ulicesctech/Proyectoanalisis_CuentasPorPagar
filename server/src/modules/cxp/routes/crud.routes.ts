import { Router } from 'express';
import type { createCxpController } from '../controllers/crud.controller';

export function createCxpRouter(controller: ReturnType<typeof createCxpController>) {
  const router = Router();
  router.get('/options', controller.options);
  router.get('/', controller.list);
  router.get('/:id', controller.getOne);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
