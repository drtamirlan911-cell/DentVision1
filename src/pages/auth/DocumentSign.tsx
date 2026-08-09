import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Stethoscope, MapPin, FileText, CheckCircle2, X } from 'lucide-react';
import SignaturePad from '../../components/ui/SignaturePad';
import { Button } from '@/components/ui/ds/Button';
import { Input } from '@/components/ui/ds/Input';
import { Badge } from '@/components/ui/ds/Badge';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

/**
 * Literal foregrounds on purpose. The fills are fixed semantic colours that do
 * not follow the theme, so the text sitting on them must not follow it either —
 * `text-txt-primary` here would be graphite on green in the light theme.
 */
const TOAST_FILL: Record<string, string> = {
  success: 'bg-success text-white',
  error: 'bg-error text-white',
  warning: 'bg-warning text-[#0B1220]',
  info: 'bg-info text-white',
};

interface DocumentData {
  id?: string;
  title?: string;
  doc_type?: string;
  content?: string;
  status?: string;
  patient_name?: string;
  signed_by_name?: string;
  clinic_name?: string;
  clinic_address?: string;
  clinic_phone?: string;
  documentId?: string;
}

interface ToastState {
  msg: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export default function DocumentSign() {
  const { t } = useTranslation();
  const { token } = useParams();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const loadDoc = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/document/${token}`);
        if (!res.ok) throw new Error('Not found');
        const data: DocumentData = await res.json();
        setDoc(data);
        if (data.status === 'signed') setSigned(true);
        if (data.patient_name) setName(data.patient_name);
      } catch {
        setToast({ msg: t('patientPortal.documents.sign_error'), type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    if (token) loadDoc();
  }, [token, t]);

  const handleSign = async (signatureData: string) => {
    if (!name.trim()) {
      setToast({ msg: t('patientPortal.documents.full_name'), type: 'warning' });
      return;
    }
    setSigning(true);
    try {
      const res = await fetch(`${API_URL}/api/public/document/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData, signedByName: name }),
      });
      if (!res.ok) throw new Error('Sign failed');
      setSigned(true);
      setToast({ msg: t('patientPortal.documents.sign_success'), type: 'success' });
    } catch {
      setToast({ msg: t('patientPortal.documents.sign_error'), type: 'error' });
    } finally {
      setSigning(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center">
      <Loader2 size={40} className="animate-spin text-dv-gold" />
    </div>
  );

  if (signed) return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-5">
      <div className="max-w-[480px] w-full text-center">
        <div className="mb-5 flex justify-center text-success">
          <CheckCircle2 size={64} />
        </div>
        <h1 className="font-serif text-3xl text-txt-primary mb-3">{t('patientPortal.documents.signed_page_title')}</h1>
        <p className="text-sm text-txt-secondary mb-2">{doc?.title}</p>
        <p className="text-xs text-txt-muted">{t('patientPortal.documents.signed_by', { name: doc?.signed_by_name || name })}</p>
        <p className="text-xs text-txt-muted mt-1">
          {doc?.clinic_name && `${doc.clinic_name}`}
          {doc?.clinic_phone && ` · ${doc.clinic_phone}`}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-0 py-10 px-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ${TOAST_FILL[toast.type] || TOAST_FILL.info}`}>
          {toast.msg}
          <button aria-label="Dismiss" onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
      <div className="max-w-[600px] mx-auto">
        <div className="text-center mb-8">
          <div className="mb-2 flex justify-center text-dv-gold">
            <Stethoscope size={40} />
          </div>
          <h1 className="font-serif text-2xl text-txt-primary">
            {doc?.clinic_name || 'DentVision'}
          </h1>
          {doc?.clinic_address && (
            <p className="text-xs text-txt-muted mt-1 flex items-center justify-center gap-1">
              <MapPin size={12} /> {doc.clinic_address}
            </p>
          )}
        </div>

        <div className="bg-surface-1 border border-dv-gold/20 rounded-2xl px-6 py-7 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-dv-gold" />
            <h2 className="font-serif text-lg text-txt-primary m-0">{doc?.title}</h2>
          </div>
          <p className="text-xs text-txt-muted mb-1">{t('patientPortal.documents.type')}: {doc?.doc_type}</p>
          <div className="bg-surface-2 rounded-[10px] p-4 border border-dv-gold/20 text-sm text-txt-secondary leading-[1.7] whitespace-pre-wrap font-serif max-h-[400px] overflow-auto">
            {doc?.content || t('patientPortal.documents.document_content_missing')}
          </div>
        </div>

        <div className="bg-surface-1 border border-dv-gold/20 rounded-2xl px-6 py-7">
          <h2 className="font-serif text-lg text-txt-primary m-0 mb-4">
            {t('patientPortal.documents.signing')}
          </h2>

          <div className="mb-3.5">
            <Input
              label={`${t('patientPortal.documents.full_name')} *`}
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder={t('patientPortal.documents.full_name_placeholder')}
              className="w-full bg-surface-2 border border-dv-gold/20 rounded-lg px-3.5 py-2.5 text-sm text-txt-primary outline-none focus:border-dv-gold transition-colors"
            />
          </div>

          <p className="text-xs text-txt-secondary mb-2">
            {t('patientPortal.documents.signature_hint')}
          </p>

          <div className="flex justify-center">
            <SignaturePad
              onSave={handleSign}
              width={Math.min(500, 400)}
              height={180}
              label={t('patientPortal.documents.signature_label')}
              clearLabel={t('patientPortal.documents.clear')}
              applyLabel={t('patientPortal.documents.apply_signature')}
            />
          </div>

          {signing && (
            <p className="text-xs text-dv-gold text-center mt-3">{t('common.loading')}</p>
          )}

          <p className="text-[10px] text-txt-muted mt-4 text-center">
            {t('patientPortal.documents.consent')}
          </p>
        </div>

        <p className="text-center text-xs text-txt-muted mt-5">
          Powered by DentVision
        </p>
      </div>
    </div>
  );
}
