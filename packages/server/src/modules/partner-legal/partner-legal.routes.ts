import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';

const partnerLegalRouter = Router();

partnerLegalRouter.use(authenticate);

partnerLegalRouter.get('/documents', (_req, res) => {
  res.json({ ok: true, data: [] });
});

partnerLegalRouter.get('/invoices', (_req, res) => {
  res.json({ ok: true, data: [] });
});

partnerLegalRouter.get('/history', (_req, res) => {
  res.json({ ok: true, data: [] });
});

partnerLegalRouter.get('/partner', (_req, res) => {
  res.json({ ok: true, data: null });
});

export { partnerLegalRouter };
