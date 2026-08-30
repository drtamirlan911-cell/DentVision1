import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two things worth pinning: one clinic must never see another's notes,
 * and when embeddings are unavailable the search must still answer — a search
 * box that silently returns nothing is worse than one returning rough matches.
 */

const { visitFindMany, embedTexts } = vi.hoisted(() => ({
  visitFindMany: vi.fn(),
  embedTexts: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ default: { visit: { findMany: visitFindMany } } }));
vi.mock('./embeddings.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  embedTexts,
}));

const { searchClinicalNotes } = await import('./clinicalSearch.js');

function visit(id: string, text: string, date = '2026-08-01') {
  return {
    id, patientId: `p-${id}`, date: new Date(date),
    diagnosis: text, complaints: null, anamnesis: null, notes: null,
    patient: { firstName: 'Иван', lastName: 'Иванов' },
  };
}

beforeEach(() => {
  visitFindMany.mockReset();
  embedTexts.mockReset();
});

describe('tenant isolation', () => {
  it('scopes every query through the patient’s clinic', async () => {
    visitFindMany.mockResolvedValue([]);

    await searchClinicalNotes({ clinicId: 'c1', query: 'периодонтит' });

    expect(visitFindMany.mock.calls[0][0].where).toMatchObject({
      patient: { clinicId: 'c1' },
      deletedAt: null,
    });
  });

  it('narrows to one patient when asked', async () => {
    visitFindMany.mockResolvedValue([]);

    await searchClinicalNotes({ clinicId: 'c1', query: 'боль', patientId: 'p9' });

    expect(visitFindMany.mock.calls[0][0].where).toMatchObject({ patientId: 'p9' });
  });
});

describe('ranking', () => {
  it('orders by meaning, not by the order rows came back', async () => {
    visitFindMany.mockResolvedValue([visit('a', 'кариес'), visit('b', 'периодонтит')]);
    // Query vector points at the second document.
    embedTexts.mockResolvedValue([[0, 1], [1, 0], [0, 1]]);

    const result = await searchClinicalNotes({ clinicId: 'c1', query: 'воспаление у верхушки корня' });

    expect(result.ranking).toBe('semantic');
    expect(result.hits.map((h) => h.visitId)).toEqual(['b', 'a']);
    expect(result.hits[0].score).toBeGreaterThan(result.hits[1].score as number);
  });

  it('answers lexically when embeddings are unavailable', async () => {
    visitFindMany.mockResolvedValue([visit('a', 'кариес')]);
    embedTexts.mockResolvedValue(null);

    const result = await searchClinicalNotes({ clinicId: 'c1', query: 'кариес' });

    expect(result.ranking).toBe('lexical');
    expect(result.hits).toHaveLength(1);
    // Null rather than a fabricated score: nothing measured the similarity.
    expect(result.hits[0].score).toBeNull();
  });

  it('honours the limit', async () => {
    visitFindMany.mockResolvedValue(['a', 'b', 'c', 'd'].map((id) => visit(id, `текст ${id}`)));
    embedTexts.mockResolvedValue([[1, 0], [1, 0], [1, 0], [1, 0], [1, 0]]);

    const result = await searchClinicalNotes({ clinicId: 'c1', query: 'текст', limit: 2 });

    expect(result.hits).toHaveLength(2);
  });
});

describe('candidate selection', () => {
  it('falls back to recent visits when no note contains the words', async () => {
    // The whole point of semantic search: the doctor wrote "периодонтит" and
    // the question says "воспаление". A lexical-only search returns nothing.
    visitFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([visit('a', 'периодонтит')]);
    embedTexts.mockResolvedValue([[0, 1], [0, 1]]);

    const result = await searchClinicalNotes({ clinicId: 'c1', query: 'воспаление верхушки' });

    expect(visitFindMany).toHaveBeenCalledTimes(2);
    expect(visitFindMany.mock.calls[1][0].where.OR).toBeUndefined();
    expect(result.hits.map((h) => h.visitId)).toEqual(['a']);
  });

  it('skips visits with no clinical text at all', async () => {
    visitFindMany.mockResolvedValue([
      { ...visit('empty', ''), diagnosis: null },
      visit('has-text', 'кариес'),
    ]);
    embedTexts.mockResolvedValue([[1, 0], [1, 0]]);

    const result = await searchClinicalNotes({ clinicId: 'c1', query: 'кариес' });

    expect(result.hits.map((h) => h.visitId)).toEqual(['has-text']);
  });

  it('returns nothing, gracefully, when the clinic has no notes', async () => {
    visitFindMany.mockResolvedValue([]);

    await expect(searchClinicalNotes({ clinicId: 'c1', query: 'что угодно' })).resolves.toEqual({
      hits: [], ranking: 'lexical',
    });
    expect(embedTexts).not.toHaveBeenCalled();
  });
});
