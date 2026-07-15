import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Register from './Register';
import { GLOBAL_CSS } from '../../utils/constants';
import { Loader2, Stethoscope, AlertTriangle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { user, login, loading, error } = useAuth();
  const [loginStr, setLoginStr] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (showRegister) return <Register onBack={() => setShowRegister(false)} />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!loginStr.trim() || !password.trim()) {
      setLocalError('╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨╗╨╛╨│╨╕╨╜ ╨╕ ╨┐╨░╤А╨╛╨╗╤М');
      return;
    }
    await login(loginStr.trim(), password);
  };

  const displayError = error || localError;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,#C9A96E08_0%,transparent_70%)] -top-24 -right-24 pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,#2980B906_0%,transparent_70%)] -bottom-20 -left-20 pointer-events-none" />

        <div className="w-full max-w-[400px] bg-[#0D1B2E] border border-[rgba(201,169,110,0.15)] rounded-[18px] py-9 px-8 shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative z-10">
          <div className="text-center mb-8">
            <div className="mb-3 flex justify-center text-[#C9A96E] drop-shadow-[0_4px_12px_rgba(201,169,110,0.4)]">
              <Stethoscope size={44} />
            </div>
            <h1 className="font-['Georgia',serif] text-[26px] font-bold text-white m-0 tracking-tight">
              DentVision
            </h1>
            <p className="text-[13px] text-[#7A8899] mt-1.5">CRM-╤Б╨╕╤Б╤В╨╡╨╝╨░ ╨┤╨╗╤П ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╕╤Е ╨║╨╗╨╕╨╜╨╕╨║</p>
          </div>

          {displayError && (
            <div className="bg-[#E74C3C]/15 border border-[#E74C3C]/30 rounded-lg px-3.5 py-2.5 mb-4 text-[13px] text-[#E74C3C] flex items-center gap-2">
              <AlertTriangle size={16} />{displayError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3.5">
              <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨Ы╨╛╨│╨╕╨╜</label>
              <input
                type="text" value={loginStr} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginStr(e.target.value)}
                placeholder="admin_c1" autoComplete="username" required
                className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">╨Я╨░╤А╨╛╨╗╤М</label>
              <input
                type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="тАвтАвтАвтАвтАвтАвтАвтАв" autoComplete="current-password" required
                className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors"
              />
              <div className="text-right mt-1.5">
                <button type="button" onClick={() => navigate('/forgot-password')} className="bg-transparent border-none text-[#C9A96E] text-xs cursor-pointer p-0">
                  ╨Ч╨░╨▒╤Л╨╗╨╕ ╨┐╨░╤А╨╛╨╗╤М?
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className={`w-full py-3 border-none rounded-lg text-[#080F1A] text-sm font-bold flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-[#8B6F3E] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#C9A96E] to-[#8B6F3E] cursor-pointer shadow-[0_6px_20px_#C9A96E35]'
              }`}
            >
              {loading ? <><Loader2 size={16} className="animate-spin text-[#080F1A]" /> ╨Т╤Е╨╛╨┤тАж</> : '╨Т╨╛╨╣╤В╨╕ ╨▓ ╤Б╨╕╤Б╤В╨╡╨╝╤Г'}
            </button>
          </form>

          <div className="mt-4 p-3.5 bg-[#27AE60]/[0.08] border border-[#27AE60]/20 rounded-[10px] flex justify-between items-center">
            <div>
              <div className="text-xs text-[#27AE60] font-bold">╨Э╨╛╨▓╨░╤П ╨║╨╗╨╕╨╜╨╕╨║╨░?</div>
              <div className="text-[11px] text-[#7A8899]">14 ╨┤╨╜╨╡╨╣ ╨▒╨╡╤Б╨┐╨╗╨░╤В╨╜╨╛</div>
            </div>
            <button
              onClick={() => setShowRegister(true)}
              className="px-3.5 py-[7px] bg-[#27AE60]/20 border border-[#27AE60]/40 rounded-lg text-[#27AE60] text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              ╨Ч╨░╤А╨╡╨│╨╕╤Б╤В╤А╨╕╤А╨╛╨▓╨░╤В╤М╤Б╤П тЖТ
            </button>
          </div>

          <div className="mt-3.5 p-3.5 bg-[#C9A96E]/[0.08] border border-[rgba(201,169,110,0.15)] rounded-[10px]">
            <div className="text-[11px] text-[#C9A96E] font-bold mb-2 uppercase tracking-[0.06em]">
              Demo-╨┤╨╛╤Б╤В╤Г╨┐
            </div>
            {[
              { login: 'admin_c1',  pass: 'admin123',        role: '╨Р╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А' },
              { login: 'doc1_c1',  pass: 'doc123',           role: '╨Т╤А╨░╤З-╤В╨╡╤А╨░╨┐╨╡╨▓╤В' },
              { login: 'dr.tamirlan', pass: 'DentVision2025!', role: 'Super Admin' },
            ].map((d, i) => (
              <button
                key={i}
                onClick={() => { setLoginStr(d.login); setPassword(d.pass); }}
                className="block w-full text-left bg-transparent border-none py-1 cursor-pointer text-[#B0BEC5] text-xs"
              >
                <span className="text-[#C9A96E] font-semibold">{d.login}</span>
                <span className="text-[#7A8899]"> / {d.pass}</span>
                <span className="text-[#7A8899] italic"> тАФ {d.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
