import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Sparkles, CheckCircle, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/ds/Button';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Textarea } from '@/components/ui/ds/Input';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useToast } from '@/components/ui/ds/Toast';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';
import { StatusPill } from './workspace/Pipeline';


export default function ReferralDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.referral(id!),
    queryFn: () => api.getDiagnosticReferral(id!),
    enabled: !!id,
  });

  const [editing, setEditing] = useState(false);
  const [reportText, setReportText] = useState('');
  const [conclusion, setConclusion] = useState('');

  const referral = data?.data;
  const result = referral?.result;

  useEffect(() => {
    if (result?.reportText) { setReportText(result.reportText); setConclusion(result.conclusion || ''); }
  }, [result]);

  const aiMutation = useMutation({
    mutationFn: () => api.aiGenerateDiagnosticResult(id!),
    onSuccess: (res: any) => {
      const text = res?.data?.reportText || '';
      setReportText(text);
      setEditing(true);
      toast.success('AI заключение сгенерировано');
      queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.referral(id!) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signMutation = useMutation({
    mutationFn: () => api.signDiagnosticResult(id!, reportText, conclusion || undefined),
    onSuccess: () => {
      toast.success('Результат подписан и внесён в медкарту');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.referral(id!) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-64" /></div>;
  if (!referral) return <div className="p-6 text-txt-muted">Направление не найдено</div>;


  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6 max-w-4xl max-w-full overflow-x-hidden">
      <PageHeader
        title={referral.patientName}
        subtitle={`${referral.studyType} · ${referral.category}`}
        icon={<FileText size={22} />}
        actions={
          <>
            <StatusPill status={referral.status} />
            <Button variant="ghost" size="sm" className="min-h-11" icon={<ArrowLeft size={16} />} onClick={() => navigate('/diagnostics/referrals')}>
              Назад
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Информация о пациенте</h3>
          <div className="space-y-2 text-sm">
            <Row label="ФИО" value={referral.patientName} />
            <Row label="ИИН" value={referral.patientIin} />
            <Row label="Телефон" value={referral.patientPhone} />
            <Row label="Email" value={referral.patientEmail} />
            {referral.allergies && <Row label="Аллергии" value={referral.allergies} />}
            {referral.specialNotes && <Row label="Особые отметки" value={referral.specialNotes} />}
          </div>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Исследование</h3>
          <div className="space-y-2 text-sm">
            <Row label="Тип" value={referral.studyType} />
            <Row label="Категория" value={referral.category} />
            <Row label="Приоритет" value={referral.priority} />
            <Row label="Клиника" value={referral.clinic?.name} />
            <Row label="Врач" value={referral.doctorName} />
            <Row label="Создано" value={new Date(referral.createdAt).toLocaleDateString('ru-RU')} />
          </div>
        </Card>

        {referral.complaints && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-txt-primary mb-3">Жалобы</h3>
            <p className="text-sm text-txt-secondary">{referral.complaints}</p>
          </Card>
        )}

        {referral.preliminaryDx && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-txt-primary mb-3">Предварительный диагноз</h3>
            <p className="text-sm text-txt-secondary">{referral.preliminaryDx}</p>
          </Card>
        )}
      </div>

      {/* Files */}
      {referral.files && referral.files.length > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Файлы ({referral.files.length})</h3>
          <div className="space-y-2">
            {referral.files.map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-1">
                <FileText size={16} className="text-dv-gold shrink-0" />
                <span className="text-sm text-txt-primary flex-1 truncate">{f.fileName}</span>
                <span className="text-xs text-txt-muted">{new Date(f.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Result section */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold text-txt-primary">Результат исследования</h3>
          <div className="flex flex-wrap gap-2">
            {!result && (referral.status === 'COMPLETED' || referral.status === 'IN_PROGRESS') && (
              <Button variant="outline" size="xs" className="min-h-11" icon={<Sparkles size={14} />}
                loading={aiMutation.isPending} onClick={() => aiMutation.mutate()}>
                AI Заключение
              </Button>
            )}
            {result && !result.signedBy && (
              <>
                <Button variant="ghost" size="xs" className="min-h-11" icon={<Edit3 size={14} />}
                  onClick={() => setEditing(!editing)}>
                  {editing ? 'Отмена' : 'Редактировать'}
                </Button>
                <Button variant="primary" size="xs" className="min-h-11" icon={<CheckCircle size={14} />}
                  loading={signMutation.isPending} onClick={() => signMutation.mutate()}>
                  Подтвердить
                </Button>
              </>
            )}
            {result?.signedBy && (
              <Badge variant="success" size="sm">Подписано</Badge>
            )}
          </div>
        </div>

        {!result && !aiMutation.isPending && referral.status !== 'COMPLETED' && referral.status !== 'IN_PROGRESS' && (
          <p className="text-sm text-txt-muted text-center py-6">Результат появится после выполнения исследования</p>
        )}

        {aiMutation.isPending && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-dv-gold border-t-transparent" />
            <span className="ml-3 text-sm text-txt-muted">AI генерирует заключение...</span>
          </div>
        )}

        {reportText && (
          <div className="space-y-4">
            {editing ? (
              <>
                <Textarea label="Заключение" value={reportText} onChange={e => setReportText(e.target.value)} rows={10} />
                <Textarea label="Вывод" value={conclusion} onChange={e => setConclusion(e.target.value)} rows={3} placeholder="Краткий вывод" />
              </>
            ) : (
              <>
                {result?.aiGenerated && (
                  // Whether the pass looked at the study or only at the
                  // referral's text is the difference between an observation
                  // and a composition — the reader has to be able to tell.
                  <Badge variant={result.aiSawSource ? 'info' : 'warning'} size="xs">
                    {result.aiSawSource
                      ? 'ИИ: по приложенному снимку'
                      : 'ИИ: без снимка, по данным направления'}
                  </Badge>
                )}
                <div className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{reportText}</div>
                {conclusion && (
                  <div className="p-3 rounded-lg bg-surface-1 border border-bdr-subtle">
                    <p className="text-xs font-bold text-txt-muted mb-1">Вывод</p>
                    <p className="text-sm text-txt-primary">{conclusion}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-txt-muted">{label}</span>
      <span className="text-txt-primary font-medium text-right">{value}</span>
    </div>
  );
}
