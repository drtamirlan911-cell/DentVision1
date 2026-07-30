import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ds';
import { AIWorkspaceIndex } from './components/intelligence/AIWorkspaceIndex';
import IntelligenceLayout from './layouts/IntelligenceLayout';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { RequirePage } from '@/components/auth/RequirePage';
import './lib/i18n';

const Login = lazyWithRetry(() => import('./pages/auth/Login'));
const ForgotPassword = lazyWithRetry(() => import('./pages/auth/ForgotPassword'));
const PublicBooking = lazyWithRetry(() => import('./pages/auth/PublicBooking'));
const DocumentSign = lazyWithRetry(() => import('./pages/auth/DocumentSign'));
const DiagnosticsRegister = lazyWithRetry(() => import('./pages/DiagnosticsRegister'));
import './styles/global.css';
import { reportWebVitals } from './utils/vitals';

// Platform pages
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const SuperAdmin = lazyWithRetry(() => import('./pages/SuperAdmin'));
const BIWorkspace = lazyWithRetry(() => import('./pages/bi/BIWorkspace'));
const SecurityCompliance = lazyWithRetry(() => import('./pages/SecurityCompliance'));
const AuditLog = lazyWithRetry(() => import('./pages/AuditLog'));
const Backup = lazyWithRetry(() => import('./pages/Backup'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const SettingsPage = lazyWithRetry(() => import('./pages/Settings'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Jobs = lazyWithRetry(() => import('./pages/Jobs'));
const Community = lazyWithRetry(() => import('./pages/Community'));
const Demo = lazyWithRetry(() => import('./pages/Demo'));
const Pricing = lazyWithRetry(() => import('./pages/Pricing'));

// Diagnostics pages
const DiagnosticsLayout = lazyWithRetry(() => import('./pages/diagnostics/DiagnosticsLayout'));
const DiagnosticsDashboard = lazyWithRetry(() => import('./pages/diagnostics/DiagnosticsDashboard'));
const ReferralList = lazyWithRetry(() => import('./pages/diagnostics/ReferralList'));
const ReferralForm = lazyWithRetry(() => import('./pages/diagnostics/ReferralForm'));
const ReferralDetail = lazyWithRetry(() => import('./pages/diagnostics/ReferralDetail'));
const CenterList = lazyWithRetry(() => import('./pages/diagnostics/CenterList'));
const LabList = lazyWithRetry(() => import('./pages/diagnostics/LabList'));
const DiagnosticPatients = lazyWithRetry(() => import('./pages/diagnostics/DiagnosticPatients'));
const ResultList = lazyWithRetry(() => import('./pages/diagnostics/ResultList'));
const DiagnosticCalendar = lazyWithRetry(() => import('./pages/diagnostics/DiagnosticCalendar'));
const DiagnosticStatistics = lazyWithRetry(() => import('./pages/diagnostics/DiagnosticStatistics'));
const DiagnosticSettings = lazyWithRetry(() => import('./pages/diagnostics/DiagnosticSettings'));
const CenterDashboard = lazyWithRetry(() => import('./pages/diagnostics/CenterDashboard'));
const LabDashboard = lazyWithRetry(() => import('./pages/diagnostics/LabDashboard'));
const RegistrationRequests = lazyWithRetry(() => import('./pages/diagnostics/RegistrationRequests'));

// CRM sub-app pages
const Schedule = lazyWithRetry(() => import('./pages/crm/Schedule'));
const Patients = lazyWithRetry(() => import('./pages/crm/Patients'));
const Cashier = lazyWithRetry(() => import('./pages/crm/Cashier'));
const Lab = lazyWithRetry(() => import('./pages/crm/Lab'));
const Staff = lazyWithRetry(() => import('./pages/crm/Staff'));
const PriceList = lazyWithRetry(() => import('./pages/crm/PriceList'));
const Promotions = lazyWithRetry(() => import('./pages/crm/Promotions'));
const Inventory = lazyWithRetry(() => import('./pages/crm/Inventory'));
const MedicalCard = lazyWithRetry(() => import('./pages/crm/MedicalCard'));
const ICD10 = lazyWithRetry(() => import('./pages/crm/ICD10'));
const Visits = lazyWithRetry(() => import('./pages/crm/Visits'));
const Documents = lazyWithRetry(() => import('./pages/crm/Documents'));
const Reminders = lazyWithRetry(() => import('./pages/crm/Reminders'));
const DentalChart = lazyWithRetry(() => import('./pages/crm/DentalChart'));
const TreatmentPlans = lazyWithRetry(() => import('./pages/crm/TreatmentPlans'));
const ClinicSettings = lazyWithRetry(() => import('./pages/crm/ClinicSettings'));
const ClinicBilling = lazyWithRetry(() => import('./pages/crm/ClinicBilling'));
const IntegrationsMessaging = lazyWithRetry(() => import('./pages/clinic/IntegrationMessaging'));

// Shop sub-app pages
const Shop = lazyWithRetry(() => import('./pages/shop/Shop'));
const ShopProduct = lazyWithRetry(() => import('./pages/shop/ShopProduct'));
const ShopCheckout = lazyWithRetry(() => import('./pages/shop/ShopCheckout'));
const ShopOrders = lazyWithRetry(() => import('./pages/shop/ShopOrders'));
const ShopFavorites = lazyWithRetry(() => import('./pages/shop/ShopFavorites'));
const ShopSuppliers = lazyWithRetry(() => import('./pages/shop/ShopSuppliers'));

// School sub-app pages
const School = lazyWithRetry(() => import('./pages/school/School'));
const SchoolCourse = lazyWithRetry(() => import('./pages/school/SchoolCourse'));
const SchoolWorkspace = lazyWithRetry(() => import('./pages/school/SchoolWorkspace'));

// Platform content-management (superadmin) pages
const ShopAdmin = lazyWithRetry(() => import('./pages/admin/ShopAdmin'));
const SchoolAdmin = lazyWithRetry(() => import('./pages/admin/SchoolAdmin'));

// Legal Engine pages
const LegalLayout = lazyWithRetry(() => import('./pages/legal/LegalLayout'));
const PartnerLegal = lazyWithRetry(() => import('./pages/partner/PartnerLegal'));

// Workspace selection
const MyClinics = lazyWithRetry(() => import('./pages/MyClinics'));

// Supplier self-service workspace
const SupplierWorkspace = lazyWithRetry(() => import('./pages/supplier/SupplierWorkspace'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C9A96E]/30 border-t-[#C9A96E]" />
    </div>
  );
}

function guarded(page: string, node: React.ReactNode) {
  return (
    <RequirePage page={page}>
      <Suspense fallback={<PageLoader />}>{node}</Suspense>
    </RequirePage>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <Providers>
            <Routes>
                {/* Public / standalone routes */}
                <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
                <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
                <Route path="/book/:clinicId" element={<Suspense fallback={<PageLoader />}><PublicBooking /></Suspense>} />
                <Route path="/sign/:token" element={<Suspense fallback={<PageLoader />}><DocumentSign /></Suspense>} />
                <Route path="/register-diagnostics" element={<Suspense fallback={<PageLoader />}><DiagnosticsRegister /></Suspense>} />

                {/* Workspace selection (no active clinic) */}
                <Route path="/my-clinics" element={<Suspense fallback={<PageLoader />}><MyClinics /></Suspense>} />

                {/* AI-First Intelligence Layout — Main entry point after login */}
                <Route path="/" element={<IntelligenceLayout />}>
                  <Route index element={<Suspense fallback={<PageLoader />}><AIWorkspaceIndex /></Suspense>} />
                  <Route path="dashboard" element={guarded('dashboard', <Dashboard />)} />
                  <Route path="intelligence" element={<Navigate to="/" replace />} />

                  {/* Platform pages */}
                  <Route path="ai" element={<Navigate to="/" replace />} />
                  <Route path="analytics" element={guarded('analytics', <Analytics />)} />
                  <Route path="settings" element={guarded('settings', <SettingsPage />)} />
                  <Route path="admin" element={guarded('admin', <SuperAdmin />)} />
                  <Route path="bi" element={guarded('bi', <BIWorkspace />)} />
                  <Route path="security" element={guarded('security', <SecurityCompliance />)} />
                  <Route path="audit" element={guarded('audit', <AuditLog />)} />
                  <Route path="backup" element={guarded('backup', <Backup />)} />
                  <Route path="profile" element={guarded('profile', <Profile />)} />
                  <Route path="supplier" element={<Suspense fallback={<PageLoader />}><SupplierWorkspace /></Suspense>} />
                  <Route path="jobs" element={<Suspense fallback={<PageLoader />}><Jobs /></Suspense>} />
                  <Route path="community" element={<Suspense fallback={<PageLoader />}><Community /></Suspense>} />
                  <Route path="demo" element={<Suspense fallback={<PageLoader />}><Demo /></Suspense>} />
                  <Route path="pricing" element={<Suspense fallback={<PageLoader />}><Pricing /></Suspense>} />

                  {/* CRM sub-app — under IntelligenceLayout sidebar */}
                  <Route path="crm/schedule" element={guarded('schedule', <Schedule />)} />
                  <Route path="crm/patients" element={guarded('patients', <Patients />)} />
                  <Route path="crm/cashier" element={guarded('cashier', <Cashier />)} />
                  <Route path="crm/pricelist" element={guarded('pricelist', <PriceList />)} />
                  <Route path="crm/lab" element={guarded('lab', <Lab />)} />
                  <Route path="crm/inventory" element={guarded('inventory', <Inventory />)} />
                  <Route path="crm/promotions" element={guarded('promotions', <Promotions />)} />
                  <Route path="crm/staff" element={guarded('staff', <Staff />)} />
                  <Route path="crm/medical-card" element={guarded('medical-card', <MedicalCard />)} />
                  <Route path="crm/icd10" element={guarded('icd10', <ICD10 />)} />
                  <Route path="crm/visits" element={guarded('visits', <Visits />)} />
                  <Route path="crm/documents" element={guarded('documents', <Documents />)} />
                  <Route path="crm/reminders" element={guarded('reminders', <Reminders />)} />
                  <Route path="crm/dental-chart" element={guarded('dental-chart', <DentalChart />)} />
                  <Route path="crm/treatment-plans" element={guarded('treatment-plans', <TreatmentPlans />)} />
                  <Route path="crm/finance" element={guarded('finance', <Cashier />)} />
                  <Route path="crm/clinic-settings" element={guarded('clinic-settings', <ClinicSettings />)} />
                  <Route path="crm/billing" element={guarded('billing', <ClinicBilling />)} />
                  <Route path="crm/integrations/messaging" element={guarded('clinic-settings', <IntegrationsMessaging />)} />

                  {/* Shop sub-app — under IntelligenceLayout sidebar */}
                  <Route path="shop" element={<Suspense fallback={<PageLoader />}><Shop /></Suspense>} />
                  <Route path="shop/:id" element={<Suspense fallback={<PageLoader />}><ShopProduct /></Suspense>} />
                  <Route path="shop/checkout" element={<Suspense fallback={<PageLoader />}><ShopCheckout /></Suspense>} />
                  <Route path="shop/orders" element={<Suspense fallback={<PageLoader />}><ShopOrders /></Suspense>} />
                  <Route path="shop/favorites" element={<Suspense fallback={<PageLoader />}><ShopFavorites /></Suspense>} />
                  <Route path="shop/suppliers" element={<Suspense fallback={<PageLoader />}><ShopSuppliers /></Suspense>} />

                  {/* School sub-app — under IntelligenceLayout sidebar */}
                  <Route path="school" element={<Suspense fallback={<PageLoader />}><School /></Suspense>} />
                  <Route path="school/:id" element={<Suspense fallback={<PageLoader />}><SchoolCourse /></Suspense>} />
                  <Route path="school-workspace" element={<Suspense fallback={<PageLoader />}><SchoolWorkspace /></Suspense>} />

                  {/* Diagnostics sub-app — under IntelligenceLayout sidebar */}
                  <Route path="diagnostics" element={<Suspense fallback={<PageLoader />}><DiagnosticsLayout /></Suspense>}>
                    <Route index element={<Suspense fallback={<PageLoader />}><DiagnosticsDashboard /></Suspense>} />
                    <Route path="referrals" element={<Suspense fallback={<PageLoader />}><ReferralList /></Suspense>} />
                    <Route path="referrals/new" element={<Suspense fallback={<PageLoader />}><ReferralForm /></Suspense>} />
                    <Route path="referrals/:id" element={<Suspense fallback={<PageLoader />}><ReferralDetail /></Suspense>} />
                    <Route path="centers" element={<Suspense fallback={<PageLoader />}><CenterList /></Suspense>} />
                    <Route path="center-dashboard" element={<Suspense fallback={<PageLoader />}><CenterDashboard /></Suspense>} />
                    <Route path="laboratories" element={<Suspense fallback={<PageLoader />}><LabList /></Suspense>} />
                    <Route path="lab-dashboard" element={<Suspense fallback={<PageLoader />}><LabDashboard /></Suspense>} />
                    <Route path="patients" element={<Suspense fallback={<PageLoader />}><DiagnosticPatients /></Suspense>} />
                    <Route path="results" element={<Suspense fallback={<PageLoader />}><ResultList /></Suspense>} />
                    <Route path="calendar" element={<Suspense fallback={<PageLoader />}><DiagnosticCalendar /></Suspense>} />
                    <Route path="statistics" element={<Suspense fallback={<PageLoader />}><DiagnosticStatistics /></Suspense>} />
                    <Route path="settings" element={<Suspense fallback={<PageLoader />}><DiagnosticSettings /></Suspense>} />
                    <Route path="registrations" element={<Suspense fallback={<PageLoader />}><RegistrationRequests /></Suspense>} />
                  </Route>

                  {/* Superadmin content management */}
                  <Route path="shop/admin" element={<Suspense fallback={<PageLoader />}><ShopAdmin /></Suspense>} />
                  <Route path="school/admin" element={<Suspense fallback={<PageLoader />}><SchoolAdmin /></Suspense>} />
                  {/* Legal Engine */}
                  <Route path="legal" element={<Suspense fallback={<PageLoader />}><LegalLayout /></Suspense>} />
                  <Route path="partner-legal" element={<Suspense fallback={<PageLoader />}><PartnerLegal /></Suspense>} />
                </Route>

                <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
              </Routes>
          </Providers>
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
  reportWebVitals();

  // PWA service worker — only register in production; unregister in dev to avoid stale caches
  if ('serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js?v=3').catch(() => {});
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      });
    }
  }
}
