import { createCxpController, cxpStringQuery } from '../crud.controller';
import {
  cxpDocumentoService, listDocumentoPage, readDocumentoExpediente, validateReceivedDocumento,
} from '../../services/documentos/documento.service';
import {
  decideDocumentoApproval, readDocumentoApprovalContext,
} from '../../services/documentos/documento.approval';
import { previewDocumentoDueDate } from '../../services/documentos/documento.dueDate';
import type { Request, Response, NextFunction } from 'express';

const baseController = createCxpController(cxpDocumentoService);

export const cxpDocumentoController = {
  ...baseController,
  async list(req: Request, res: Response, next: NextFunction) {
    if (req.query.filterField !== undefined) return baseController.list(req, res, next);
    try {
      const query = Object.fromEntries(['page', 'limit', 'search', 'estado', 'idProveedor', 'venceHasta']
        .map(key => [key, cxpStringQuery(req, key)]));
      res.json(await listDocumentoPage(query));
    } catch (error) { next(error); }
  },
  async expediente(req: Request, res: Response, next: NextFunction) {
    try { res.json(await readDocumentoExpediente(Number(req.params.id))); }
    catch (error) { next(error); }
  },
  async validate(req: Request, res: Response, next: NextFunction) {
    try { res.json(await validateReceivedDocumento(Number(req.params.id))); }
    catch (error) { next(error); }
  },
  async approval(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = cxpStringQuery(req, 'actorId');
      res.json(await readDocumentoApprovalContext(Number(req.params.id), actor === undefined ? undefined : Number(actor)));
    } catch (error) { next(error); }
  },
  async decideApproval(req: Request, res: Response, next: NextFunction) {
    try { res.json(await decideDocumentoApproval(Number(req.params.id), req.body)); }
    catch (error) { next(error); }
  },
  async previewDueDate(req: Request, res: Response, next: NextFunction) {
    try { res.json(await previewDocumentoDueDate(req.body)); }
    catch (error) { next(error); }
  },
};
