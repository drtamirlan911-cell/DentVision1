import { useState } from 'react';
import { Sparkles, Send, Pencil, Check, X as XIcon, RefreshCw, ShieldCheck } from 'lucide-react';
import { Drawer, Button, Badge, EmptyState, Skeleton } from '@/components/ui/ds';
import { Textarea } from '@/components/ui/ds/Input';
import { useToast } from '@/components/ui/ds/Toast';
import type { PatientPresentationBeat } from '@/utils/api';
import {
  usePlanReleases, usePlanPresentation, useApproveTreatmentPlan, usePublishPlanRelease,
  useGeneratePresentation, useEditPresentationBeat, usePublishPresentation,
} from '@/queries/presentation.query';

interface PresentationPreviewProps {
  open: boolean;
  onClose: () => void;
  planId: string;
}

const GENERATOR_LABEL: Record<string, string> = { template: 'Шаблон', llm: 'ИИ', doctor: 'Правка врача' };
const GENERATOR_BADGE: Record<string, 'default' | 'gold' | 'success'> = { template: 'default', llm: 'gold', doctor: 'success' };

function fd(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
}

/**
 * Takes a doctor through "approve (if needed) → generate → review/edit →
 * publish" for one plan's presentation — a self-contained drawer rather
 * than a separate release-history screen, since none exists yet.
 */
export function PresentationPreview({ open, onClose, planId }: PresentationPreviewProps) {
  const toast = useToast();
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');

  const releasesQuery = usePlanReleases(open ? planId : undefined);
  const releases = Array.isArray(releasesQuery.data) ? releasesQuery.data : [];
  const approvedRelease = releases.find((r: any) => r.status === 'approved') || null;
  const releaseId: string | undefined = approvedRelease?.id;

  const presentationQuery = usePlanPresentation(releaseId);
  const approveMutation = useApproveTreatmentPlan(planId);
  const publishReleaseMutation = usePublishPlanRelease(planId);
  const generateMutation = useGeneratePresentation(releaseId);
  const editMutation = useEditPresentationBeat(releaseId);
  const publishMutation = usePublishPresentation(releaseId);

  const presentation = presentationQuery.data;

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync();
      toast.success('План утверждён');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось утвердить план');
    }
  };

  const handlePublishWithoutAi = async () => {
    if (!releaseId) return;
    try {
      await publishReleaseMutation.mutateAsync(releaseId);
      toast.success('План опубликован пациенту');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось опубликовать план');
    }
  };

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync();
      toast.success('Презентация сгенерирована');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось сгенерировать презентацию');
    }
  };

  const startEdit = (beat: PatientPresentationBeat) => {
    setEditingBeatId(beat.id);
    setDraftText(beat.say);
  };

  const saveEdit = async (beatId: string) => {
    if (!presentation) return;
    if (!draftText.trim()) { toast.error('Текст реплики не может быть пустым'); return; }
    try {
      await editMutation.mutateAsync({ presentationId: presentation.id, beatId, say: draftText });
      setEditingBeatId(null);
      toast.success('Реплика сохранена');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось сохранить правку');
    }
  };

  const handlePublish = async () => {
    if (!presentation) return;
    try {
      await publishMutation.mutateAsync(presentation.id);
      toast.success('Презентация опубликована');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось опубликовать презентацию');
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Презентация плана" width={480}>
      <div className="space-y-4">
        {releasesQuery.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : !approvedRelease ? (
          <EmptyState
            icon={<ShieldCheck size={24} />}
            title="План ещё не утверждён"
            description="Презентацию можно построить только для плана, утверждённого врачом."
            action={
              <Button size="sm" loading={approveMutation.isPending} onClick={handleApprove}>
                Утвердить план
              </Button>
            }
          />
        ) : (
          <>
            <div className="rounded-xl border border-bdr-subtle p-3 flex items-center justify-between gap-2">
              <div className="text-xs text-txt-muted">
                Релиз v{approvedRelease.version} · утверждён {fd(approvedRelease.approvedAt)}
              </div>
              {approvedRelease.publishedAt ? (
                <Badge variant="success" size="xs">Релиз опубликован</Badge>
              ) : (
                <Button size="xs" variant="ghost" loading={publishReleaseMutation.isPending} onClick={handlePublishWithoutAi}>
                  Опубликовать без ИИ
                </Button>
              )}
            </div>

            {presentationQuery.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            ) : !presentation ? (
              <EmptyState
                icon={<Sparkles size={24} />}
                title="Презентация ещё не сгенерирована"
                description="ИИ перепишет реплики сценария естественнее — каждая пройдёт проверку на новые факты, цифры и обещания."
                action={
                  <Button size="sm" icon={<Sparkles size={14} />} loading={generateMutation.isPending} onClick={handleGenerate}>
                    Сгенерировать через ИИ
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={presentation.status === 'published' ? 'success' : 'default'} size="xs">
                    {presentation.status === 'published' ? 'Опубликовано' : 'Черновик'}
                  </Badge>
                  <div className="flex gap-2">
                    <Button
                      size="xs" variant="ghost" icon={<RefreshCw size={12} />}
                      loading={generateMutation.isPending} onClick={handleGenerate}
                    >
                      Перегенерировать
                    </Button>
                    {presentation.status === 'draft' && (
                      <Button size="xs" icon={<Send size={12} />} loading={publishMutation.isPending} onClick={handlePublish}>
                        Опубликовать
                      </Button>
                    )}
                  </div>
                </div>

                {presentation.script.acts.map((act) => (
                  <div key={act.id} className="space-y-2">
                    <p className="text-xs font-medium text-txt-secondary">{act.title}</p>
                    {act.beats.map((beat) => {
                      const generator = presentation.generatorByBeat[beat.id] || 'template';
                      const failure = presentation.validationReport?.beats.find(
                        (b) => b.beatId === beat.id && !b.accepted,
                      );
                      const isEditing = editingBeatId === beat.id;
                      return (
                        <div key={beat.id} className="rounded-xl border border-bdr-subtle p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={GENERATOR_BADGE[generator]} size="xs">{GENERATOR_LABEL[generator]}</Badge>
                            {!isEditing && (
                              <Button size="xs" variant="ghost" icon={<Pencil size={12} />} onClick={() => startEdit(beat)}>
                                Править
                              </Button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={3} />
                              <div className="flex gap-2 justify-end">
                                <Button size="xs" variant="ghost" icon={<XIcon size={12} />} onClick={() => setEditingBeatId(null)}>
                                  Отмена
                                </Button>
                                <Button size="xs" icon={<Check size={12} />} loading={editMutation.isPending} onClick={() => saveEdit(beat.id)}>
                                  Сохранить
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-txt-primary">{beat.say}</p>
                          )}
                          {failure && (
                            <p className="text-2xs text-warning">
                              {failure.failures.map((f) => f.detail).join('; ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
