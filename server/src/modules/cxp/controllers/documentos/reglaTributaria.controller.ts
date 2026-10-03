import type { Request, Response, NextFunction } from 'express';
import { cxpStringQuery } from '../crud.controller';
import { cxpReglaTributariaService } from '../../services/documentos/reglaTributaria.service';

export const cxpReglaTributariaController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await cxpReglaTributariaService.list({
        codigoRegla: cxpStringQuery(req, 'codigoRegla'), estado: cxpStringQuery(req, 'estado'), search: cxpStringQuery(req, 'search'),
      }));
    } catch (error) { next(error); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await cxpReglaTributariaService.create(req.body)); }
    catch (error) { next(error); }
  },
  async nuevaVersion(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await cxpReglaTributariaService.nuevaVersion(Number(req.params.id), req.body)); }
    catch (error) { next(error); }
  },
  async finalizar(req: Request, res: Response, next: NextFunction) {
    try { res.json(await cxpReglaTributariaService.finalizar(Number(req.params.id), req.body)); }
    catch (error) { next(error); }
  },
};
