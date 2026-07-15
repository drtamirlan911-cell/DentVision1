import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { HOURS, ALL_SERVICES } from '../../utils/constants';
import { rateLimit, validatePhone, validateEmail, sanitizeInput } from '../../utils/security';
import { Loader2, Stethoscope, MapPin, Phone, CheckCircle2, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

interface PublicClinic {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
}

interface PublicDoctor {
  id: string;
  name: string;
  spec?: string;
}

interface BookingForm {
  patientName: string;
  phone: string;
  email: string;
  doctorId: string;
  serviceName: string;
  date: string;
  time: string;
  notes: string;
}

interface ToastState {
  msg: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export default function PublicBooking() {
  const { clinicId } = useParams();
  const [clinic, setClinic] = useState<PublicClinic | null>(null);
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [form, setForm] = useState<BookingForm>({
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
        setToast({ msg: '╨Ъ╨╗╨╕╨╜╨╕╨║╨░ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    if (clinicId) loadClinic();
  }, [clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateLimit('booking', { maxAttempts: 5, windowMs: 60000 })) {
      setToast({ msg: '╨б╨╗╨╕╤И╨║╨╛╨╝ ╨╝╨╜╨╛╨│╨╛ ╨╖╨░╤П╨▓╨╛╨║. ╨Я╨╛╨┤╨╛╨╢╨┤╨╕╤В╨╡ ╨╝╨╕╨╜╤Г╤В╤Г.', type: 'warning' });
      return;
    }
    if (!form.patientName.trim()) {
      setToast({ msg: '╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨▓╨░╤И╨╡ ╨╕╨╝╤П', type: 'warning' });
      return;
    }
    if (!validatePhone(form.phone)) {
      setToast({ msg: '╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ ╨╜╨╛╨╝╨╡╤А ╤В╨╡╨╗╨╡╤Д╨╛╨╜╨░', type: 'warning' });
      return;
    }
    if (!form.date) {
      setToast({ msg: '╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┤╨░╤В╤Г', type: 'warning' });
      return;
    }
    if (!form.time) {
      setToast({ msg: '╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨▓╤А╨╡╨╝╤П', type: 'warning' });
      return;
    }
    if (form.email && !validateEmail(form.email)) {
      setToast({ msg: '╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ email', type: 'warning' });
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
      if (!res.ok) throw new Error('╨Ю╤И╨╕╨▒╨║╨░');
      setSuccess(true);
    } catch {
      setToast({ msg: '╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╛╤В╨┐╤А╨░╨▓╨║╨╡. ╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨┐╨╛╨╖╨╢╨╡.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#C9A96E]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center p-5">
        <div className="max-w-[440px] w-full text-center">
          <div className="mb-5 flex justify-center text-[#27AE60]">
            <CheckCircle2 size={64} />
          </div>
          <h1 className="font-['Georgia',serif] text-[26px] text-white mb-3">╨Ч╨░╤П╨▓╨║╨░ ╨╛╤В╨┐╤А╨░╨▓╨╗╨╡╨╜╨░!</h1>
          <p className="text-sm text-[#B0BEC5] mb-6">
            ╨Ь╤Л ╤Б╨▓╤П╨╢╨╡╨╝╤Б╤П ╤Б ╨▓╨░╨╝╨╕ ╨┤╨╗╤П ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╨╕╤П ╨╖╨░╨┐╨╕╤Б╨╕ ╨▓ ╨▒╨╗╨╕╨╢╨░╨╣╤И╨╡╨╡ ╨▓╤А╨╡╨╝╤П.
          </p>
          <button onClick={() => { setSuccess(false); setForm({ patientName: '', phone: '', email: '', doctorId: '', serviceName: '', date: '', time: '', notes: '' }); }}
            className="px-7 py-3 bg-gradient-to-r from-[#C9A96E] to-[#8B6F3E] border-none rounded-[10px] text-[#080F1A] text-sm font-bold cursor-pointer">
            ╨Ч╨░╨┐╨╕╤Б╨░╤В╤М╤Б╤П ╨╡╤Й╤С ╤А╨░╨╖
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080F1A] py-10 px-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'bg-[#27AE60] text-white' : toast.type === 'error' ? 'bg-[#E74C3C] text-white' : toast.type === 'warning' ? 'bg-[#F39C12] text-[#080F1A]' : 'bg-[#2980B9] text-white'}`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
      <div className="max-w-[520px] mx-auto">
        <div className="text-center mb-9">
          <div className="mb-3 flex justify-center text-[#C9A96E]">
            <Stethoscope size={44} />
          </div>
          <h1 className="font-['Georgia',serif] text-[28px] font-bold text-white m-0">
            {clinic?.name || '╨Ю╨╜╨╗╨░╨╣╨╜-╨╖╨░╨┐╨╕╤Б╤М'}
          </h1>
          {clinic?.address && (
            <p className="text-[13px] text-[#7A8899] mt-1.5 flex items-center justify-center gap-1">
              <MapPin size={14} /> {clinic.address}{clinic.city ? `, ${clinic.city}` : ''}
            </p>
          )}
          {clinic?.phone && (
            <p className="text-[13px] text-[#B0BEC5] mt-1 flex items-center justify-center gap-1">
              <Phone size={14} /> {clinic.phone}
            </p>
          )}
        </div>

        <div className="bg-[#0D1B2E] border border-[rgba(201,169,110,0.15)] rounded-[18px] px-7 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          <h2 className="font-['Georgia',serif] text-lg text-white m-0 mb-5">
            ╨Ч╨░╨┐╨╕╤Б╨░╤В╤М╤Б╤П ╨╜╨░ ╨┐╤А╨╕╤С╨╝
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-3.5">
              <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨Т╨░╤И╨╡ ╨╕╨╝╤П *</label>
              <input type="text" value={form.patientName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, patientName: e.target.value })}
                placeholder="╨Ш╨▓╨░╨╜╨╛╨▓ ╨Ш╨▓╨░╨╜ ╨Ш╨▓╨░╨╜╨╛╨▓╨╕╤З" required
                className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨в╨╡╨╗╨╡╤Д╨╛╨╜ *</label>
                <input type="tel" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+7 777 000 00 00" required
                  className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors" />
              </div>
            </div>

            {doctors.length > 0 && (
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨Т╤А╨░╤З</label>
                <select value={form.doctorId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, doctorId: e.target.value })}
                  className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors">
                  <option value="" className="bg-[#0D1B2E]">╨Ы╤О╨▒╨╛╨╣ ╨┤╨╛╤Б╤В╤Г╨┐╨╜╤Л╨╣</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id} className="bg-[#0D1B2E]">{d.name}{d.spec ? ` тАФ ${d.spec}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-3.5">
              <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨г╤Б╨╗╤Г╨│╨░</label>
              <select value={form.serviceName} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, serviceName: e.target.value })}
                className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors">
                <option value="" className="bg-[#0D1B2E]">╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╤Г╤Б╨╗╤Г╨│╤Г</option>
                {Object.entries(ALL_SERVICES.reduce<Record<string, typeof ALL_SERVICES>>((acc, s) => { (acc[s.cat] = acc[s.cat] || []).push(s); return acc; }, {})).map(([cat, services]) => (
                  <optgroup key={cat} label={cat}>
                    {services.map(s => <option key={s.id} value={s.name} className="bg-[#0D1B2E]">{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨Ф╨░╤В╨░ *</label>
                <input type="date" value={form.date} min={minDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, date: e.target.value })}
                  required className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨Т╤А╨╡╨╝╤П *</label>
                <select value={form.time} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, time: e.target.value })}
                  required className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors">
                  <option value="" className="bg-[#0D1B2E]">╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡</option>
                  {HOURS.map(h => <option key={h} value={h} className="bg-[#0D1B2E]">{h}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨Ъ╨╛╨╝╨╝╨╡╨╜╤В╨░╤А╨╕╨╣</label>
              <textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, notes: e.target.value })}
                rows={3} placeholder="╨Ю╨┐╨╕╤И╨╕╤В╨╡ ╨╢╨░╨╗╨╛╨▒╤Л ╨╕╨╗╨╕ ╨┐╨╛╨╢╨╡╨╗╨░╨╜╨╕╤П..."
                className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors resize-y" />
            </div>

            <button type="submit" disabled={submitting}
              className={`w-full py-3.5 border-none rounded-[10px] text-[#080F1A] text-[15px] font-bold ${
                submitting
                  ? 'bg-[#8B6F3E] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#C9A96E] to-[#8B6F3E] cursor-pointer shadow-[0_6px_20px_#C9A96E35]'
              }`}>
              {submitting ? '╨Ю╤В╨┐╤А╨░╨▓╨║╨░...' : '╨Ч╨░╨┐╨╕╤Б╨░╤В╤М╤Б╤П ╨╜╨░ ╨┐╤А╨╕╤С╨╝'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#7A8899] mt-5">
          Powered by DentVision
        </p>
      </div>
    </div>
  );
}
