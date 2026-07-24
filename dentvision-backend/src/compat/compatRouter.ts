import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const compatRouter = Router();

// Public service-access endpoint (no auth, used by public booking widget)
compatRouter.get('/service-access/public/:clinicId', async (req: Request, res: Response) => {
  try {
    const clinicId = String(req.params.clinicId);
    const access = await prisma.serviceAccess.findMany({ where: { clinicId } });
    const ALL_SERVICES = ['crm', 'shop', 'school', 'ai', 'analytics', 'settings'];
    const map: Record<string, boolean> = {};
    for (const svc of ALL_SERVICES) {
      const found = access.find((a: { service: string; enabled: boolean }) => a.service === svc);
      map[svc] = found ? found.enabled : true;
    }
    res.json(map);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default compatRouter;
