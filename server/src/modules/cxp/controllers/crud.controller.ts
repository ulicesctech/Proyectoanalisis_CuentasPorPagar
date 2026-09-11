import type { Request, Response, NextFunction } from 'express';
import type { CxpListQuery } from '@erp/contracts';
import type { CxpService } from '../services/crud.service';
import { CxpError } from '../services/errors';

export function cxpStringQuery(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (value !== undefined && typeof value !== 'string') throw new CxpError(`El parámetro ${key} debe ser un texto`);
  return value as string | undefined;
}

export function createCxpController(service: CxpService) {
  return {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const query: CxpListQuery = Object.fromEntries(['page', 'limit', 'search', 'filterField', 'filterValue'].map(key => [key, cxpStringQuery(req, key)]));
        res.json(await service.list(query));
      } catch (error) { next(error); }
    },
    async getOne(req: Request, res: Response, next: NextFunction) {
      try { res.json(await service.getOne(Number(req.params.id))); }
      catch (error) { next(error); }
    },
    async options(req: Request, res: Response, next: NextFunction) {
      try { res.json(await service.options({ search: cxpStringQuery(req, 'search'), selected: cxpStringQuery(req, 'selected') })); }
      catch (error) { next(error); }
    },
    async create(req: Request, res: Response, next: NextFunction) {
      try { res.status(201).json(await service.create(req.body)); }
      catch (error) { next(error); }
    },
    async update(req: Request, res: Response, next: NextFunction) {
      try { res.json(await service.update(Number(req.params.id), req.body)); }
      catch (error) { next(error); }
    },
    async remove(req: Request, res: Response, next: NextFunction) {
      try { await service.remove(Number(req.params.id)); res.status(204).send(); }
      catch (error) { next(error); }
    },
  };
}
