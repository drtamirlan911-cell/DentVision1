import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Calendar, FileText, Receipt, Activity, LogIn, UserPlus,
  ClipboardList, FileImage, User, CheckCircle2, Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@/components/ui/ds/Misc';
import { ConsentGate } from './ConsentGate';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';
import type { PortalTab } from './shared';
import { AppointmentsTab } from './tabs/AppointmentsTab';
import { TreatmentsTab } from './tabs/TreatmentsTab';
import { VisitsTab } from './tabs/VisitsTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { DiagnosticsTab } from './tabs/DiagnosticsTab';
import { AccessTab } from './tabs/AccessTab';
import { Assistant } from './Assistant';

export default function PatientPortal() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PortalTab>('assistant');

  // Arriving from a booking confirmation: the clinic and the phone used to book
  // come along in the query. `/link` attaches this account to the card
  // reception already holds — matching by phone as well as email — instead of
  // leaving the patient staring at an empty portal.
  //
  // Nothing called this endpoint before. The clinic link and the phone are the
  // difference between "your visits" and a second, blank card in the same
  // clinic.
  const linkClinicId = searchParams.get('clinic');
  const linkPhone = searchParams.get('phone');
  const [linkState, setLinkState] = useState<'idle' | 'linking' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (!isAuthenticated || !linkClinicId || linkState !== 'idle') return;
    setLinkState('linking');
    api
      .linkPatientToClinic({ clinicId: linkClinicId, phone: linkPhone || undefined })
      .then(() => {
        setLinkState('done');
        // Every tab was fetched before the link existed and answered 403.
        // The keys are flat strings rather than a shared prefix, so they are
        // named here; a new tab has to be added to this list.
        for (const key of ['pp-appointments', 'pp-treatments', 'pp-visits', 'pp-invoices', 'pp-documents', 'pp-diagnostics']) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      })
      .catch(() => setLinkState('failed'));
  }, [isAuthenticated, linkClinicId, linkPhone, linkState, queryClient]);

  const tabs = useMemo(() => [
    { id: 'assistant' as PortalTab, label: t('patientPortal.tabs.assistant'), icon: <Sparkles size={14} /> },
    { id: 'appointments' as PortalTab, label: t('patientPortal.tabs.appointments'), icon: <Calendar size={14} /> },
    { id: 'treatments' as PortalTab, label: t('patientPortal.tabs.treatments'), icon: <Activity size={14} /> },
    { id: 'visits' as PortalTab, label: t('patientPortal.tabs.visits'), icon: <ClipboardList size={14} /> },
    { id: 'payments' as PortalTab, label: t('patientPortal.tabs.payments'), icon: <Receipt size={14} /> },
    { id: 'documents' as PortalTab, label: t('patientPortal.tabs.documents'), icon: <FileImage size={14} /> },
    { id: 'diagnostics' as PortalTab, label: t('patientPortal.tabs.diagnostics'), icon: <FileText size={14} /> },
    { id: 'access' as PortalTab, label: t('patientPortal.tabs.access'), icon: <CheckCircle2 size={14} /> },
  ], [t]);

  const portalReturnUrl = `/patient-portal${linkClinicId ? `?clinic=${encodeURIComponent(linkClinicId)}${linkPhone ? `&phone=${encodeURIComponent(linkPhone)}` : ''}` : ''}`;

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <Card padding="lg">
            <h1 className="text-2xl font-bold text-txt-primary mb-2">{t('patientPortal.title')}</h1>
            <p className="text-sm text-txt-muted mb-6">{t('patientPortal.subtitle')}</p>
            <div className="space-y-3">
              {/* Carry the clinic and phone through the login round-trip, so a
                  patient who arrives from a booking is still linked afterwards. */}
              <Button variant="primary" className="w-full" onClick={() => navigate(`/login?portal=patient&returnUrl=${encodeURIComponent(portalReturnUrl)}`)} icon={<LogIn size={16} />}>{t('patientPortal.login')}</Button>
              <Button variant="outline" className="w-full" onClick={() => navigate(`/login?portal=patient&register=1&returnUrl=${encodeURIComponent(portalReturnUrl)}`)} icon={<UserPlus size={16} />}>{t('patientPortal.register')}</Button>

              {/* The shortest path for a patient arriving from a booking: one
                  click instead of inventing a password for one more service. */}
              <GoogleSignInButton onCredential={(idToken) => void loginWithGoogle(idToken)} />

              <p className="text-xs text-txt-ghost pt-2">{t('patientPortal.link_hint')}</p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    // Every portal route is behind `requireConsent()`, so the agreements come
    // first or nothing below can load at all.
    <ConsentGate>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title={t('patientPortal.title')}
        subtitle={t('patientPortal.welcome', { name: user.name || user.login })}
        icon={<User size={22} />}
        actions={
          <Button asChild variant="outline" size="sm" className="min-h-11" icon={<Calendar size={14} />} disabled={!user.clinicId}>
            <Link to={user.clinicId ? `/book/${user.clinicId}` : '#'}>{t('patientPortal.book_online')}</Link>
          </Button>
        }
      />

      <Tabs variant="underline" tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as PortalTab)} />

      <div className="min-h-[200px]">
        {activeTab === 'assistant' && <Assistant />}
        {activeTab === 'appointments' && <AppointmentsTab />}
        {activeTab === 'treatments' && <TreatmentsTab />}
        {activeTab === 'visits' && <VisitsTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'documents' && <DocumentsTab />}
        {activeTab === 'diagnostics' && <DiagnosticsTab />}
        {activeTab === 'access' && <AccessTab />}
      </div>
    </motion.div>
    </ConsentGate>
  );
}
