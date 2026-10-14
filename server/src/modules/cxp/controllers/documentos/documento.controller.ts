import { createCxpController, cxpStringQuery } from '../crud.controller';
import {
  cxpDocumentoService, listDocumentoPage, readDocumentoExpediente, validateReceivedDocumento,
} from '../../services/documentos/documento.service';
import {
  decideDocumentoApproval, readDocumentoApprovalContext,
} from '../../services/documentos/documento.approval';
import { previewDocumentoDueDate } from '../../services/documentos/documento.dueDate';
import { documentoDteReads, uploadDocumentoDte } from '../../services/documentos/documentoArchivo.service';
import { documentoPaymentOperations, listDocumentoEligiblePayments } from '../../services/documentos/documento.payment';
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
  async uploadDte(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await uploadDocumentoDte(Number(req.params.id), req.body,
        req.header('X-File-Name'), req.header('Content-Type')));
    } catch (error) { next(error); }
  },
  async listFiles(req: Request, res: Response, next: NextFunction) {
    try { res.json(await documentoDteReads.list(Number(req.params.id))); }
    catch (error) { next(error); }
  },
  async downloadDte(req: Request, res: Response, next: NextFunction) {
    try {
      const { metadata, content } = await documentoDteReads.download(Number(req.params.id), Number(req.params.idArchivo));
      const encodedName = encodeURIComponent(metadata.nombreArchivo)
        .replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
      res.setHeader('Content-Type', metadata.tipoMime);
      res.setHeader('Content-Length', content.length);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(content);
    } catch (error) { next(error); }
  },
  async eligiblePayments(req: Request, res: Response, next: NextFunction) {
    try { res.json(await listDocumentoEligiblePayments(Number(req.params.id), cxpStringQuery(req, 'search'))); }
    catch (error) { next(error); }
  },
  async applyPayment(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await documentoPaymentOperations.apply(Number(req.params.id), req.body)); }
    catch (error) { next(error); }
  },
  async reversePayment(req: Request, res: Response, next: NextFunction) {
    try { res.json(await documentoPaymentOperations.reverse(Number(req.params.id), Number(req.params.idAplicacion), req.body)); }
    catch (error) { next(error); }
  },
};
