import { Router } from 'express';

const legalStubRouter = Router();

const empty: string[] = [];
['dashboard', 'templates', 'blocks', 'partners', 'documents', 'invoices', 'audit', 'platform-settings']
  .forEach((p) => {
    legalStubRouter.get(`/${p}`, (_req, res) => res.json({ ok: true, data: empty, brands: empty, pagination: { page: 1, limit: 20, total: 0, pages: 0 } }));
    legalStubRouter.get(`/${p}/:id`, (_req, res) => res.status(404).json({ ok: false, error: 'Not implemented' }));
    legalStubRouter.post(`/${p}`, (_req, res) => res.status(501).json({ ok: false, error: 'Not implemented' }));
  });

export { legalStubRouter };
