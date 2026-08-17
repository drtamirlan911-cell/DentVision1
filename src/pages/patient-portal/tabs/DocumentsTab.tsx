import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileImage, FileSignature, Eye, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { Modal } from '@/components/ui/ds/Modal';
import { Input } from '@/components/ui/ds/Input';
import SignaturePad from '@/components/ui/SignaturePad';
import * as api from '@/utils/api';
import { useFormatters, TabLoader, TabError, downloadDocument } from '../shared';

function SignDocumentModal({ document, onClose }: { document: any; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(document?.signedByName || document?.patientName || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSign = async (signatureData: string) => {
    if (!name.trim()) {
      setError(t('patientPortal.documents.full_name'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.signDocument(document.id, { signatureData, signedByName: name.trim() });
      queryClient.invalidateQueries({ queryKey: ['pp-documents'] });
      onClose();
    } catch (e: any) {
      setError(e?.message || t('patientPortal.documents.sign_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={t('patientPortal.documents.signing')} size="md">
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-error/10 border border-error/25 rounded-xl px-3 py-2.5 text-xs text-error">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <div className="rounded-xl border border-dv-gold/20 bg-dv-gold/5 p-3 text-xs text-txt-secondary space-y-1">
          <p><span className="text-txt-muted">{t('patientPortal.documents.title')}:</span> {document.title}</p>
          <p><span className="text-txt-muted">{t('patientPortal.documents.type')}:</span> {document.docType}</p>
        </div>
        <Input
          label={t('patientPortal.documents.full_name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('patientPortal.documents.full_name_placeholder')}
          required
        />
        <p className="text-xs text-txt-muted">{t('patientPortal.documents.signature_hint')}</p>
        <div className="flex justify-center">
          <SignaturePad
            onSave={handleSign}
            width={Math.min(500, 340)}
            height={160}
            label={t('patientPortal.documents.signature_label')}
            clearLabel={t('patientPortal.documents.clear')}
            applyLabel={t('patientPortal.documents.apply_signature')}
          />
        </div>
        {submitting && <p className="text-xs text-dv-gold text-center">{t('common.loading')}</p>}
        {/* `text-2xs` is the scale's 10px step; `text-[10px]` was off-scale. */}
        <p className="text-2xs text-txt-ghost text-center">{t('patientPortal.documents.consent')}</p>
      </div>
    </Modal>
  );
}

export function DocumentsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-documents'],
    queryFn: () => api.apiRequest('/api/patient-portal/documents'),
  });
  const fmt = useFormatters();
  const [signDoc, setSignDoc] = useState<any>(null);
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<FileImage size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.documents')}
        description={t('patientPortal.empty.documents_desc')}
      />
    );
  }
  return (
    <>
      <div className="space-y-3">
        {items.map((d: any) => {
          const isSigned = !!d.signedAt;
          return (
            <Card key={d.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 mt-0.5">
                  <FileImage size={20} className="text-txt-muted" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-txt-primary truncate">{d.title}</p>
                  <p className="text-xs text-txt-muted mt-0.5">{d.docType} · {d.clinic?.name}</p>
                  <p className="text-xs text-txt-ghost mt-0.5">{fmt.dateShort(d.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <Badge variant={isSigned ? 'success' : 'warning'} size="sm">
                  {isSigned ? t('patientPortal.documents.signed') : t('patientPortal.documents.pending')}
                </Badge>
                {isSigned ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Eye size={14} />}
                    onClick={() => downloadDocument(d.id, d.title)}
                  >
                    {t('patientPortal.documents.view')}
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" icon={<FileSignature size={14} />} onClick={() => setSignDoc(d)}>
                    {t('patientPortal.documents.sign')}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {signDoc && <SignDocumentModal document={signDoc} onClose={() => setSignDoc(null)} />}
    </>
  );
}

export default DocumentsTab;
