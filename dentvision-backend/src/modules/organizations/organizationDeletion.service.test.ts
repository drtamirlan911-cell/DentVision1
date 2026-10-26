import { beforeEach, describe, expect, it, vi } from 'vitest';
const prismaMock = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(async () => null as any),
    delete: vi.fn(async (args: any) => ({ id: args.where.id })),
  },
}));
vi.mock('../../lib/prisma.js', () => ({ default: prismaMock }));
import { deleteOrganizationIfEmpty } from './organizationDeletion.service.js';
const org = (persons: number, branches: number) => ({id:'org-1',name:'Acme',_count:{persons,branches}});

describe('deleteOrganizationIfEmpty', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns 404 for an unknown organization', async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce(null);
    expect(await deleteOrganizationIfEmpty('missing')).toEqual({ok:false,status:404,error:'Организация не найдена'});
    expect(prismaMock.organization.delete).not.toHaveBeenCalled();
  });
  it('refuses deletion when people remain', async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce(org(2,0));
    expect(await deleteOrganizationIfEmpty('org-1')).toMatchObject({ok:false,status:409});
    expect(prismaMock.organization.delete).not.toHaveBeenCalled();
  });
  it('refuses deletion when branches remain', async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce(org(0,1));
    expect(await deleteOrganizationIfEmpty('org-1')).toMatchObject({ok:false,status:409});
    expect(prismaMock.organization.delete).not.toHaveBeenCalled();
  });
  it('deletes an empty organization', async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce(org(0,0));
    expect(await deleteOrganizationIfEmpty('org-1')).toEqual({ok:true,data:{id:'org-1',name:'Acme'}});
    expect(prismaMock.organization.delete).toHaveBeenCalledWith({where:{id:'org-1'}});
  });
});
