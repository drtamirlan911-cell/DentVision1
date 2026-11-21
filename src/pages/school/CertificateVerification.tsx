import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Award, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { getSchoolCertificateVerification } from '@/utils/api';

type VerifiedCertificate = {
  certificateNumber: string;
  status: string;
  issuedAt: string;
  issuer: string;
  courseTitle: string;
  category?: string | null;
};

export default function CertificateVerification() {
  const { verificationCode = '' } = useParams();
  const [certificate, setCertificate] = useState<VerifiedCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getSchoolCertificateVerification(verificationCode)
      .then((row) => { if (active) setCertificate(row as VerifiedCertificate); })
      .catch((reason: any) => { if (active) { setCertificate(null); setError(reason?.message || 'Сертификат не найден или недействителен'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [verificationCode]);

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 py-10 md:p-8">
      <PageHeader title="Проверка сертификата" subtitle="Публичная проверка записи об образовательном достижении DentVision" icon={<ShieldCheck size={22} />} />
      {loading ? (
        <Card padding="lg"><p className="text-sm text-txt-muted">Проверяем сертификат…</p></Card>
      ) : certificate ? (
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold"><Award size={24} /></div>
            <div className="min-w-0">
              <Badge variant="success"><CheckCircle2 size={12} /> Действующая запись</Badge>
              <h2 className="mt-2 text-lg font-semibold text-txt-primary">{certificate.courseTitle}</h2>
            </div>
          </div>
          <div className="grid gap-3 rounded-xl bg-surface-2 p-4 sm:grid-cols-2">
            <div><p className="text-xs text-txt-muted">Номер сертификата</p><p className="mt-1 font-medium text-txt-primary">{certificate.certificateNumber}</p></div>
            <div><p className="text-xs text-txt-muted">Дата выдачи</p><p className="mt-1 font-medium text-txt-primary">{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(certificate.issuedAt))}</p></div>
            <div><p className="text-xs text-txt-muted">Выдавшая организация</p><p className="mt-1 font-medium text-txt-primary">{certificate.issuer}</p></div>
            <div><p className="text-xs text-txt-muted">Категория</p><p className="mt-1 font-medium text-txt-primary">{certificate.category || 'Образовательная программа'}</p></div>
          </div>
          <p className="text-xs text-txt-muted">Эта страница подтверждает наличие и статус записи в системе DentVision. Она не является подтверждением государственной аккредитации или записи в государственном реестре квалификаций.</p>
        </Card>
      ) : (
        <Card padding="lg" className="space-y-3">
          <div className="flex items-center gap-2 text-rose-600"><XCircle size={20} /><span className="font-semibold">Сертификат не подтверждён</span></div>
          <p className="text-sm text-txt-secondary">{error || 'Запись не найдена, отозвана или недействительна.'}</p>
        </Card>
      )}
      <Link className="inline-block text-sm text-dv-gold underline" to="/school">Перейти в Academy OS</Link>
    </main>
  );
}
