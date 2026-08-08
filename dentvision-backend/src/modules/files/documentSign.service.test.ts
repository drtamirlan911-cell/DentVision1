import { beforeEach, describe, expect, it, vi } from 'vitest';

const { documentFindUnique, documentUpdate } = vi.hoisted(() => ({
  documentFindUnique: vi.fn(),
  documentUpdate: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    document: { findUnique: documentFindUnique, update: documentUpdate },
  },
}));

import { createSignLink, getDocumentForSigning, signDocument } from './documentSign.service.js';

beforeEach(() => {
  documentFindUnique.mockReset();
  documentUpdate.mockReset();
});

describe('createSignLink', () => {
  it('throws 404 when the document does not exist', async () => {
    documentFindUnique.mockResolvedValueOnce(null);
    await expect(createSignLink('doc-1')).rejects.toMatchObject({ status: 404 });
  });

  it('generates and persists a new token when none exists', async () => {
    documentFindUnique.mockResolvedValueOnce({ signToken: null });
    documentUpdate.mockResolvedValueOnce({});
    const { token, signUrl } = await createSignLink('doc-1');
    expect(token).toMatch(/^[a-z0-9]+$/);
    expect(signUrl).toBe(`/sign/doc-1?token=${token}`);
    expect(documentUpdate).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { signToken: token } });
  });

  it('reuses an existing token without writing again', async () => {
    documentFindUnique.mockResolvedValueOnce({ signToken: 'existing-token' });
    const { token } = await createSignLink('doc-1');
    expect(token).toBe('existing-token');
    expect(documentUpdate).not.toHaveBeenCalled();
  });
});

describe('getDocumentForSigning', () => {
  it('returns null for an empty token without querying', async () => {
    const result = await getDocumentForSigning('');
    expect(result).toBeNull();
    expect(documentFindUnique).not.toHaveBeenCalled();
  });

  it('returns null when no document matches the token', async () => {
    documentFindUnique.mockResolvedValueOnce(null);
    const result = await getDocumentForSigning('tok');
    expect(result).toBeNull();
  });

  it('decodes composer-authored (data:text/plain) content and joins patient/clinic', async () => {
    const text = 'Согласие на лечение';
    const url = `data:text/plain;charset=utf-8;base64,${Buffer.from(text, 'utf-8').toString('base64')}`;
    documentFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      name: 'Информированное согласие',
      type: 'consent',
      url,
      signed: false,
      signedByName: null,
      patient: { firstName: 'Анна', lastName: 'Иванова' },
      clinic: { name: 'DentVision Clinic', address: 'ул. Абая 1', phone: '+7 700 000 00 00' },
    });
    const result = await getDocumentForSigning('tok');
    expect(result).toEqual({
      id: 'doc-1',
      title: 'Информированное согласие',
      doc_type: 'consent',
      content: text,
      status: 'pending',
      patient_name: 'Анна Иванова',
      signed_by_name: null,
      clinic_name: 'DentVision Clinic',
      clinic_address: 'ул. Абая 1',
      clinic_phone: '+7 700 000 00 00',
      documentId: 'doc-1',
    });
  });

  it('does not expose the raw storage URL for uploaded (non-text) documents', async () => {
    documentFindUnique.mockResolvedValueOnce({
      id: 'doc-2',
      name: 'Скан.pdf',
      type: 'upload',
      url: 'https://storage.example.com/private/doc-2.pdf',
      signed: true,
      signedByName: 'Пётр Петров',
      patient: null,
      clinic: null,
    });
    const result = await getDocumentForSigning('tok');
    expect(result?.content).toBeNull();
    expect(result?.status).toBe('signed');
    expect(result?.signed_by_name).toBe('Пётр Петров');
  });
});

describe('signDocument', () => {
  it('throws 404 when the document does not exist', async () => {
    documentFindUnique.mockResolvedValueOnce(null);
    await expect(signDocument({ documentId: 'doc-1' })).rejects.toMatchObject({ status: 404 });
  });

  it('authorizes via a matching public token', async () => {
    documentFindUnique.mockResolvedValueOnce({ id: 'doc-1', clinicId: 'c1', signToken: 'tok', signed: false });
    documentUpdate.mockResolvedValueOnce({ id: 'doc-1', signed: true });
    const result = await signDocument({ documentId: 'doc-1', token: 'tok', signatureData: 'data:image/png;base64,x', signedByName: 'Анна' });
    expect(result).toEqual({ id: 'doc-1', signed: true });
    expect(documentUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { signed: true, signedAt: expect.any(Date), signatureData: 'data:image/png;base64,x', signedByName: 'Анна' },
    });
  });

  it('authorizes via same-clinic staff when no token is supplied', async () => {
    documentFindUnique.mockResolvedValueOnce({ id: 'doc-1', clinicId: 'c1', signToken: 'tok', signed: false });
    documentUpdate.mockResolvedValueOnce({ id: 'doc-1', signed: true });
    const result = await signDocument({ documentId: 'doc-1', requesterClinicId: 'c1', signedByName: 'Reception' });
    expect(result).toEqual({ id: 'doc-1', signed: true });
  });

  it('rejects a mismatched token from a different clinic staff member', async () => {
    documentFindUnique.mockResolvedValueOnce({ id: 'doc-1', clinicId: 'c1', signToken: 'tok', signed: false });
    await expect(
      signDocument({ documentId: 'doc-1', token: 'wrong-token', requesterClinicId: 'c2' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('is idempotent — signing an already-signed document returns it unchanged instead of overwriting', async () => {
    const already = { id: 'doc-1', clinicId: 'c1', signToken: 'tok', signed: true, signatureData: 'original' };
    documentFindUnique.mockResolvedValueOnce(already);
    const result = await signDocument({ documentId: 'doc-1', token: 'tok', signatureData: 'attempted-overwrite' });
    expect(result).toBe(already);
    expect(documentUpdate).not.toHaveBeenCalled();
  });
});
