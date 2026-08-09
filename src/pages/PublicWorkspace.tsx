"use client"
import React, { useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/store/auth.store';
import { useGuestStore } from '@/store/guest.store';
import LoginModal from '@/components/auth/LoginModal';

const PublicWorkspace = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { isGuest } = useGuestStore();

  const isLoginModalOpen = !isAuthenticated && !isGuest && location.pathname === '/';

  const returnUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');
    if (returnUrl) return returnUrl;
    if (location.pathname !== '/') {
      return location.pathname + location.search + location.hash;
    }
    return location.pathname + location.search + location.hash;
  }, [location]);

  useEffect(() => {
    if (searchParams.get('guest')) {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-0 p-4 w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-6xl mx-auto">
        {/* `bg-white/5` and unset text colours only ever worked on the dark
            theme — on the light one this was white panels on ivory with
            whatever colour the body happened to inherit. */}
        <h1 className="text-5xl font-semibold tracking-tight text-center text-txt-primary mb-2">DentVision</h1>
        <h2 className="text-xl text-center text-txt-secondary mb-8">AI for Digital Dentistry</h2>
        <div className="bg-surface-1 border border-bdr-subtle rounded-xl p-8 mb-8">
          <p className="text-center text-txt-secondary mb-4">Чем могу помочь?</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {['AI Assistant', 'Shop', 'Jobs', 'School', 'Community', 'Demo Clinic'].map((item) => (
            <div key={item} className="bg-surface-1 border border-bdr-subtle rounded-lg p-4 min-h-11 flex items-center text-txt-primary">
              {item}
            </div>
          ))}
        </div>
      </div>
      <LoginModal
        isOpen={isLoginModalOpen}
        returnUrl={returnUrl}
      />
    </div>
  );
};

export default PublicWorkspace;
