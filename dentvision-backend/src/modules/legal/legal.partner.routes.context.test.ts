// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  legalPartnerFindUnique: vi.fn(),
  getLegalPartnerForContext: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    organization: { findUnique: mocks.organizationFindUnique },
    legalPartner: { findUnique: mocks.legalPartnerFindUnique },
  },
}));

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', clinicId: null };
    next();
  },
}));

vi.mock('./legal.audit.js', () => ({ writeAuditLog: vi.fn() }));
vi.mock('./legal.service.js', () => ({
  onboardPartner: vi.fn(),
  buildDocumentContent: vi.fn(),
}));
vi.mock('./legal.trust.service.js', () => ({
  ensureLegalTrustPackage: vi.fn(),
  getLegalPartnerForContext: mocks.getLegalPartnerForContext,
}));
vi.mock('../../lib/orgContext.js', () => ({ resolveAnyClinicMembership: vi.fn() }));
vi.mock('../../lib/organizationLegalAccess.js', () => ({
  hasOrganizationLegalOwnerAuthority: vi.fn(),
}));

import { legalPartnerRouter } from './legal.partner.routes.js';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/legal/partner', legalPartnerRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.organizationFindUnique.mockResolvedValue({ id: 'org-1' });
  mocks.legalPartnerFindUnique.mockResolvedValue({
    id: 'legacy-partner',
    legalName: 'Legacy legal entity',
    bin: '000000000000',
    director: 'Owner',
    address: 'Taraz',
    iban: 'KZ000000000000000000',
    phone: '',
    email: '',
    type: 'CLINIC',
    plan: 'FREE',
  });
  mocks.getLegalPartnerForContext.mockImplementation(async (_userId: string, organizationId?: string | null) => {
    if (organizationId) return null;
    return { id: 'legacy-partner' };
  });
});

describe('legal partner organization context isolation', () => {
  it('does not fall back to an unscoped legacy partner when an organization is active', async () => {
    const response = await fetch(`${baseUrl}/partner`);

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('Доступ только для партнёров платформы');
    expect(mocks.getLegalPartnerForContext).toHaveBeenCalledTimes(1);
    expect(mocks.getLegalPartnerForContext).toHaveBeenCalledWith('user-1', 'org-1');
    expect(mocks.legalPartnerFindUnique).not.toHaveBeenCalled();
  });
});
