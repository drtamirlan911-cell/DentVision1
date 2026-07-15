import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Stethoscope, MapPin, FileText, CheckCircle2, X } from 'lucide-react';
import SignaturePad from '../components/ui/SignaturePad';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

interface DocumentData {
  title?: string;
  doc_type?: string;
  content?: string;
  status?: string;
  patient_name?: string;
  signed_by_name?: string;
  clinic_name?: string;
  clinic_address?: string;
  clinic_phone?: string;
}

interface ToastState {
  msg: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export default function DocumentSign() {
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
        setToast({ msg: 'Документ не найден или уже подписан', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    if (token) loadDoc();
  }, [token]);

  const handleSign = async (signatureData: string) => {
    if (!name.trim()) {
      setToast({ msg: 'Введите ваше имя', type: 'warning' });
      return;
    }
    setSigning(true);
    try {
      const res = await fetch(`${API_URL}/api/documents/0/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data: signatureData, signed_by_name: name, token }),
      });
      if (!res.ok) throw new Error('Sign failed');
      setSigned(true);
      setToast({ msg: 'Документ успешно подписан!', type: 'success' });
    } catch {
      setToast({ msg: 'Ошибка при подписании. Попробуйте ещё раз.', type: 'error' });
    } finally {
      setSigning(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#080F1A] flex items-center justify-center">
      <Loader2 size={40} className="animate-spin text-[#C9A96E]" />
    </div>
  );

  if (signed) return (
    <div className="min-h-screen bg-[#080F1A] flex items-center justify-center p-5">
      <div className="max-w-[480px] w-full text-center">
        <div className="mb-5 flex justify-center text-[#27AE60]">
          <CheckCircle2 size={64} />
        </div>
        <h1 className="font-['Georgia',serif] text-[26px] text-white mb-3">Документ подписан</h1>
        <p className="text-sm text-[#B0BEC5] mb-2">{doc?.title}</p>
        <p className="text-xs text-[#7A8899]">Подпись: {doc?.signed_by_name || name}</p>
        <p className="text-xs text-[#7A8899] mt-1">
          {doc?.clinic_name && `${doc.clinic_name}`}
          {doc?.clinic_phone && ` · ${doc.clinic_phone}`}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080F1A] py-10 px-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'bg-[#27AE60] text-white' : toast.type === 'error' ? 'bg-[#E74C3C] text-white' : toast.type === 'warning' ? 'bg-[#F39C12] text-[#080F1A]' : 'bg-[#2980B9] text-white'}`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
      <div className="max-w-[600px] mx-auto">
        <div className="text-center mb-8">
          <div className="mb-2 flex justify-center text-[#C9A96E]">
            <Stethoscope size={40} />
          </div>
          <h1 className="font-['Georgia',serif] text-2xl text-white">
            {doc?.clinic_name || 'DentVision'}
          </h1>
          {doc?.clinic_address && (
            <p className="text-xs text-[#7A8899] mt-1 flex items-center justify-center gap-1">
              <MapPin size={12} /> {doc.clinic_address}
            </p>
          )}
        </div>

        <div className="bg-[#0D1B2E] border border-[rgba(201,169,110,0.15)] rounded-2xl px-6 py-7 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-[#C9A96E]" />
            <h2 className="font-['Georgia',serif] text-lg text-white m-0">{doc?.title}</h2>
          </div>
          <p className="text-[11px] text-[#7A8899] mb-1">Тип: {doc?.doc_type}</p>
          <div className="bg-white/[0.03] rounded-[10px] p-4 border border-[rgba(201,169,110,0.15)] text-[13px] text-[#B0BEC5] leading-[1.7] whitespace-pre-wrap font-['Georgia',serif] max-h-[400px] overflow-auto">
            {doc?.content || 'Содержимое документа отсутствует.'}
          </div>
        </div>

        <div className="bg-[#0D1B2E] border border-[rgba(201,169,110,0.15)] rounded-2xl px-6 py-7">
          <h2 className="font-['Georgia',serif] text-lg text-white m-0 mb-4">
            Электронная подпись
          </h2>

          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">Ваше ФИО *</label>
            <input type="text" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors" />
          </div>

          <p className="text-xs text-[#B0BEC5] mb-2">
            Подпишите ниже, используя мышь или палец на экране:
          </p>

          <div className="flex justify-center">
            <SignaturePad onSave={handleSign} width={Math.min(500, 400)} height={180} />
          </div>

          {signing && (
            <p className="text-xs text-[#C9A96E] text-center mt-3">Отправка подписи...</p>
          )}

          <p className="text-[10px] text-[#7A8899] mt-4 text-center">
            Нажимая «Применить подпись», вы подтверждаете согласие с содержимым документа.
          </p>
        </div>

        <p className="text-center text-[11px] text-[#7A8899] mt-5">
          Powered by DentVision
        </p>
      </div>
    </div>
  );
}
