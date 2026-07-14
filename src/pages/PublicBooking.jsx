import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { T, HOURS, ALL_SERVICES, sanitizeInput } from '../utils/constants';
import { rateLimit, validatePhone, validateEmail, escapeHtml } from '../utils/security';
import { Spinner, Toast } from '../components/ui/BaseComponents';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function PublicBooking() {
  const { clinicId } = useParams();
  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    patientName: '',
    phone: '',
    email: '',
    doctorId: '',
    serviceName: '',
    date: '',
    time: '',
    notes: '',
  });

  useEffect(() => {
    const loadClinic = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/clinic/${clinicId}`);
        if (!res.ok) throw new Error('Clinic not found');
        const data = await res.json();
        setClinic(data.clinic);
        setDoctors(data.doctors || []);
      } catch {
        setToast({ msg: 'Клиника не найдена', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    if (clinicId) loadClinic();
  }, [clinicId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rateLimit('booking', { maxAttempts: 5, windowMs: 60000 })) {
      setToast({ msg: 'Слишком много заявок. Подождите минуту.', type: 'warning' });
      return;
    }
    if (!form.patientName.trim()) {
      setToast({ msg: 'Введите ваше имя', type: 'warning' });
      return;
    }
    if (!validatePhone(form.phone)) {
      setToast({ msg: 'Введите корректный номер телефона', type: 'warning' });
      return;
    }
    if (!form.date) {
      setToast({ msg: 'Выберите дату', type: 'warning' });
      return;
    }
    if (!form.time) {
      setToast({ msg: 'Выберите время', type: 'warning' });
      return;
    }
    if (form.email && !validateEmail(form.email)) {
      setToast({ msg: 'Введите корректный email', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/public/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          patient_name: sanitizeInput(form.patientName),
          phone: sanitizeInput(form.phone),
          email: sanitizeInput(form.email),
          doctor_id: form.doctorId || null,
          service_name: sanitizeInput(form.serviceName),
          date: form.date,
          time: form.time,
          notes: sanitizeInput(form.notes),
        }),
      });
      if (!res.ok) throw new Error('Ошибка');
      setSuccess(true);
    } catch {
      setToast({ msg: 'Ошибка при отправке. Попробуйте позже.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, color: T.white, marginBottom: 12 }}>Заявка отправлена!</h1>
          <p style={{ fontSize: 14, color: T.slateL, marginBottom: 24 }}>
            Мы свяжемся с вами для подтверждения записи в ближайшее время.
          </p>
          <button onClick={() => { setSuccess(false); setForm({ patientName: '', phone: '', email: '', doctorId: '', serviceName: '', date: '', time: '', notes: '' }); }} style={{
            padding: '12px 28px', background: `linear-gradient(135deg,${T.gold},${T.goldDim})`, border: 'none',
            borderRadius: 10, color: T.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Записаться ещё раз
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '40px 20px' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🦷</div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 700, color: T.white, margin: 0 }}>
            {clinic?.name || 'Онлайн-запись'}
          </h1>
          {clinic?.address && (
            <p style={{ fontSize: 13, color: T.slate, marginTop: 6 }}>
              📍 {clinic.address}{clinic.city ? `, ${clinic.city}` : ''}
            </p>
          )}
          {clinic?.phone && (
            <p style={{ fontSize: 13, color: T.slateL, marginTop: 4 }}>📞 {clinic.phone}</p>
          )}
        </div>

        {/* Form */}
        <div style={{
          background: T.navy, border: `1px solid ${T.border}`, borderRadius: 18,
          padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,.4)',
        }}>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 18, color: T.white, margin: '0 0 20px 0' }}>
            Записаться на приём
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Ваше имя *</label>
              <input type="text" value={form.patientName} onChange={e => setForm({ ...form, patientName: e.target.value })}
                placeholder="Иванов Иван Иванович" required
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Телефон *</label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+7 777 000 00 00" required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            {doctors.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Врач</label>
                <select value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                  <option value="">Любой доступный</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}{d.spec ? ` — ${d.spec}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Услуга</label>
              <select value={form.serviceName} onChange={e => setForm({ ...form, serviceName: e.target.value })}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                <option value="">Выберите услугу</option>
                {Object.entries(ALL_SERVICES.reduce((acc, s) => { (acc[s.cat] = acc[s.cat] || []).push(s); return acc; }, {})).map(([cat, services]) => (
                  <optgroup key={cat} label={cat}>
                    {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Дата *</label>
                <input type="date" value={form.date} min={minDate} onChange={e => setForm({ ...form, date: e.target.value })}
                  required style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Время *</label>
                <select value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                  required style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                  <option value="">Выберите</option>
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Комментарий</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3} placeholder="Опишите жалобы или пожелания..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <button type="submit" disabled={submitting} style={{
              width: '100%', padding: '14px',
              background: submitting ? T.goldDim : `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
              border: 'none', borderRadius: 10, color: T.bg, fontSize: 15, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              boxShadow: submitting ? 'none' : `0 6px 20px ${T.gold}35`,
            }}>
              {submitting ? 'Отправка...' : 'Записаться на приём'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: T.slate, marginTop: 20 }}>
          Powered by DentVision
        </p>
      </div>
    </div>
  );
}
