import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { T } from '../utils/constants';
import { Spinner, Toast } from '../components/ui/BaseComponents';
import SignaturePad from '../components/ui/SignaturePad';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

export default function DocumentSign() {
  const { token } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const loadDoc = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/document/${token}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
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

  const handleSign = async (signatureData) => {
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
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={40} />
    </div>
  );

  if (signed) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, color: T.white, marginBottom: 12 }}>Документ подписан</h1>
        <p style={{ fontSize: 14, color: T.slateL, marginBottom: 8 }}>{doc?.title}</p>
        <p style={{ fontSize: 12, color: T.slate }}>Подпись: {doc?.signed_by_name || name}</p>
        <p style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>
          {doc?.clinic_name && `${doc.clinic_name}`}
          {doc?.clinic_phone && ` · ${doc.clinic_phone}`}
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '40px 20px' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🦷</div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 24, color: T.white }}>
            {doc?.clinic_name || 'DentVision'}
          </h1>
          {doc?.clinic_address && <p style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>📍 {doc.clinic_address}</p>}
        </div>

        <div style={{
          background: T.navy, border: `1px solid ${T.border}`, borderRadius: 16,
          padding: '28px 24px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 18, color: T.white, margin: 0 }}>{doc?.title}</h2>
          </div>
          <p style={{ fontSize: 11, color: T.slate, marginBottom: 4 }}>Тип: {doc?.doc_type}</p>
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16,
            border: `1px solid ${T.border}`, fontSize: 13, color: T.slateL,
            lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif',
            maxHeight: 400, overflow: 'auto',
          }}>
            {doc?.content || 'Содержимое документа отсутствует.'}
          </div>
        </div>

        <div style={{
          background: T.navy, border: `1px solid ${T.border}`, borderRadius: 16,
          padding: '28px 24px',
        }}>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 18, color: T.white, margin: '0 0 16px 0' }}>
            Электронная подпись
          </h2>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Ваше ФИО *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <p style={{ fontSize: 12, color: T.slateL, marginBottom: 8 }}>
            Подпишите ниже, используя мышь или палец на экране:
          </p>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SignaturePad onSave={handleSign} width={Math.min(500, 400)} height={180} />
          </div>

          {signing && (
            <p style={{ fontSize: 12, color: T.gold, textAlign: 'center', marginTop: 12 }}>Отправка подписи...</p>
          )}

          <p style={{ fontSize: 10, color: T.slate, marginTop: 16, textAlign: 'center' }}>
            Нажимая «Применить подпись», вы подтверждаете согласие с содержимым документа.
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: T.slate, marginTop: 20 }}>
          Powered by DentVision
        </p>
      </div>
    </div>
  );
}
