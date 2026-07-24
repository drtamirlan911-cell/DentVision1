import prisma from '../../../lib/prisma.js';

export interface AIInteractionLogParams {
  userId: string;
  clinicId?: string;
  sessionId?: string;
  model: string;
  toolsCalled: string[];
  tokenCount?: number;
  latencyMs?: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

export async function logAIInteraction(params: AIInteractionLogParams): Promise<void> {
  try {
    await prisma.aIActionLog.create({
      data: {
        userId: params.userId,
        agent: params.model,
        model: params.model,
        request: {
          clinicId: params.clinicId || null,
          sessionId: params.sessionId || null,
          tools: params.toolsCalled,
        },
        response: {
          tokenCount: params.tokenCount ?? null,
          latencyMs: params.latencyMs ?? null,
          status: params.status,
          errorMessage: params.errorMessage || null,
        },
      },
    });
  } catch (err) {
    console.error('[AuditLogger] failed to log AI interaction:', err);
  }
}
