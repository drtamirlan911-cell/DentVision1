/**
 * Semantic search over the clinic's own clinical free text.
 *
 * `Visit.diagnosis / complaints / anamnesis / notes` is the largest body of
 * writing this product accumulates and, until now, nothing read it back. The
 * only search anywhere was `contains` with `mode: 'insensitive'` — an
 * unindexed `ILIKE '%…%'` that finds "периодонтит" only if the doctor spelled
 * it that way, and never finds "воспаление у верхушки корня".
 *
 * **Hybrid, deliberately.** A lexical pass narrows the corpus, embeddings rank
 * what survives. Ranking every visit in a clinic would mean loading every
 * vector on every query, and an approximate index (pgvector) would mean a
 * Postgres extension this deployment cannot be assumed to have. Narrow first,
 * rank second: cheap, exact over the candidates, and no new infrastructure.
 * When the corpus outgrows this, the upgrade path is an index — not a rewrite,
 * since the vectors are already stored.
 */

import prisma from '../../../lib/prisma.js';
import { cosineSimilarity, embedTexts } from './embeddings.js';

/** How many rows the lexical pass may hand to the ranker. */
const MAX_CANDIDATES = 200;

export interface ClinicalHit {
  visitId: string;
  patientId: string;
  patientName: string;
  date: string;
  snippet: string;
  /** Cosine similarity, or null when ranking fell back to lexical order. */
  score: number | null;
}

export interface ClinicalSearchResult {
  hits: ClinicalHit[];
  /** `semantic` when embeddings ranked the result, `lexical` when they were unavailable. */
  ranking: 'semantic' | 'lexical';
}

/** Every word a doctor might have used, so the lexical pass casts a wide net. */
function keywords(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4)
    .slice(0, 6);
}

function visitText(v: {
  diagnosis: string | null;
  complaints: string | null;
  anamnesis: string | null;
  notes: string | null;
}): string {
  return [v.diagnosis, v.complaints, v.anamnesis, v.notes].filter(Boolean).join('. ');
}

export async function searchClinicalNotes(input: {
  clinicId: string;
  query: string;
  patientId?: string;
  limit?: number;
}): Promise<ClinicalSearchResult> {
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 25);
  const words = keywords(input.query);

  // Visits carry no clinicId of their own — they are scoped through the
  // patient, and that join is what keeps one clinic out of another's records.
  const where: Record<string, unknown> = {
    deletedAt: null,
    patient: { clinicId: input.clinicId },
    ...(input.patientId ? { patientId: input.patientId } : {}),
  };
  if (words.length > 0) {
    where.OR = words.flatMap((w) => [
      { diagnosis: { contains: w, mode: 'insensitive' } },
      { complaints: { contains: w, mode: 'insensitive' } },
      { anamnesis: { contains: w, mode: 'insensitive' } },
      { notes: { contains: w, mode: 'insensitive' } },
    ]);
  }

  let candidates = await prisma.visit.findMany({
    where: where as never,
    orderBy: { date: 'desc' },
    take: MAX_CANDIDATES,
    select: {
      id: true, patientId: true, date: true,
      diagnosis: true, complaints: true, anamnesis: true, notes: true,
      patient: { select: { firstName: true, lastName: true } },
    },
  });

  // A question phrased in words no note contains is exactly the case semantic
  // search exists for, so an empty lexical result falls back to recent visits
  // rather than giving up.
  if (candidates.length === 0 && words.length > 0) {
    delete where.OR;
    candidates = await prisma.visit.findMany({
      where: where as never,
      orderBy: { date: 'desc' },
      take: MAX_CANDIDATES,
      select: {
        id: true, patientId: true, date: true,
        diagnosis: true, complaints: true, anamnesis: true, notes: true,
        patient: { select: { firstName: true, lastName: true } },
      },
    });
  }

  const withText = candidates
    .map((v) => ({ visit: v, text: visitText(v) }))
    .filter((c) => c.text.trim().length > 0);

  const toHit = (c: (typeof withText)[number], score: number | null): ClinicalHit => ({
    visitId: c.visit.id,
    patientId: c.visit.patientId,
    patientName: `${c.visit.patient?.firstName ?? ''} ${c.visit.patient?.lastName ?? ''}`.trim(),
    date: c.visit.date.toISOString().slice(0, 10),
    snippet: c.text.slice(0, 400),
    score,
  });

  if (withText.length === 0) return { hits: [], ranking: 'lexical' };

  const vectors = await embedTexts([input.query, ...withText.map((c) => c.text)]);
  if (!vectors) {
    // Embeddings unavailable: recent-first lexical matches beat no answer.
    return { hits: withText.slice(0, limit).map((c) => toHit(c, null)), ranking: 'lexical' };
  }

  const [queryVector, ...docVectors] = vectors;
  const ranked = withText
    .map((c, i) => ({ c, score: cosineSimilarity(queryVector, docVectors[i]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { hits: ranked.map((r) => toHit(r.c, Number(r.score.toFixed(4)))), ranking: 'semantic' };
}
