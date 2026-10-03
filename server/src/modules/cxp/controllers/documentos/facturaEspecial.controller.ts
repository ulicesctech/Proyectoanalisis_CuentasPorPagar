import type { Request, Response, NextFunction } from 'express';
import { cxpStringQuery } from '../crud.controller';
import { cxpFacturaEspecialService } from '../../services/documentos/facturaEspecial.service';

type Accion = 'enviarRevision' | 'revisar' | 'devolver' | 'aprobar' | 'rechazar' | 'reabrir' | 'emitir' | 'anular';

export const cxpFacturaEspecialController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = Object.fromEntries(['page', 'limit', 'search', 'etapa', 'idProveedor'].map(key => [key, cxpStringQuery(req, key)]));
      res.json(await cxpFacturaEspecialService.list(query));
    } catch (error) { next(error); }
  },
  async getOne(req: Request, res: Response, next: NextFunction) {
    try { res.json(await cxpFacturaEspecialService.getOne(Number(req.params.id))); }
    catch (error) { next(error); }
  },
  async calcular(req: Request, res: Response, next: NextFunction) {
    try { res.json(await cxpFacturaEspecialService.calcular(req.body)); }
    catch (error) { next(error); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await cxpFacturaEspecialService.create(req.body)); }
    catch (error) { next(error); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { res.json(await cxpFacturaEspecialService.update(Number(req.params.id), req.body)); }
    catch (error) { next(error); }
  },
  accion(nombre: Accion) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await cxpFacturaEspecialService[nombre](Number(req.params.id), req.body)); }
      catch (error) { next(error); }
    };
  },
  async constancia(req: Request, res: Response, next: NextFunction) {
    try {
      const { nombre, pdf } = await cxpFacturaEspecialService.constancia(Number(req.params.id));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(pdf);
    } catch (error) { next(error); }
  },
};
