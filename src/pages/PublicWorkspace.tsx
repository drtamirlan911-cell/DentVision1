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
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-0 p-4">
      <div className="w-full max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">DentVision</h1>
        <h2 className="text-xl text-center mb-8">AI for Digital Dentistry</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 mb-8">
          <p className="text-center mb-4">Чем могу помочь?</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">AI Assistant</div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">Shop</div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">Jobs</div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">School</div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">Community</div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">Demo Clinic</div>
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
