import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ds';
import IntelligenceLayout from './layouts/IntelligenceLayout';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { RequirePage } from '@/components/auth/RequirePage';
import { initSentry } from './lib/sentry';
import './lib/i18n';
import './styles/global.css';
import { reportWebVitals } from './utils/vitals';

initSentry();

const AIWorkspaceIndex = lazyWithRetry(() => import('./components/intelligence/AIWorkspaceRoute'));
const Welcome = lazyWithRetry(() => import('./pages/Welcome'));
const Login = lazyWithRetry(() => import('./pages/auth/Login'));
const ForgotPassword = lazyWithRetry(() => import('./pages/auth/ForgotPassword'));
const PublicBookingDiscovery = lazyWithRetry(() => import('./pages/auth/PublicBookingDiscovery'));
const PublicDiagnosticsDiscovery = lazyWithRetry(() => import('./pages/auth/PublicDiagnosticsDiscovery'));
const PublicBooking = lazyWithRetry(() => import('./pages/auth/PublicBooking'));
const DocumentSign = lazyWithRetry(() => import('./pages/auth/DocumentSign'));
const TreatmentPresentation = lazyWithRetry(() => import('./pages/patient-portal/TreatmentPresentation'));
const DiagnosticsRegister = lazyWithRetry(() => import('./pages/DiagnosticsRegister'));
const PatientPortal = lazyWithRetry(() => import('./pages/patient-portal/PatientPortal'));

const SuperAdmin = lazyWithRetry(() => import('./pages/SuperAdmin'));
const BIWorkspace = lazyWithRetry(() => import('./pages/bi/BIWorkspace'));
const SecurityCompliance = lazyWithRetry(() => import('./pages/SecurityCompliance'));
const AuditLog = lazyWithRetry(() => import('./pages/AuditLog'));
const AgentActivity = lazyWithRetry(() => import('./pages/AgentActivity'));
const AiApprovals = lazyWithRetry(() => import('./pages/AiApprovals'));
const Backup = lazyWithRetry(() => import('./pages/Backup'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const SettingsPage = lazyWithRetry(() => import('./pages/Settings'));
const NotificationPreferences = lazyWithRetry(() => import('./pages/NotificationPreferences'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Jobs = lazyWithRetry(() => import('./pages/Jobs'));
const Community = lazyWithRetry(() => import('./pages/Community'));
const Help = lazyWithRetry(() => import('./pages/Help'));
const Demo = lazyWithRetry(() => import('./pages/Demo'));
const Pricing = lazyWithRetry(() => import('./pages/Pricing'));
const Terms = lazyWithRetry(() => import('./pages/legal-public/Terms'));
const Privacy = lazyWithRetry(() => import('./pages/legal-public/Privacy'));

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
const WorkspaceEntry = lazyWithRetry(() => import('./pages/diagnostics/WorkspaceEntry'));
const RegistrationRequests = lazyWithRetry(() => import('./pages/diagnostics/RegistrationRequests'));

const Schedule = lazyWithRetry(() => import('./pages/crm/Schedule'));
const Patients = lazyWithRetry(() => import('./pages/crm/Patients'));
const ClinicalCaseWorkspace = lazyWithRetry(() => import('./pages/crm/ClinicalCaseWorkspace'));
const Cashier = lazyWithRetry(() => import('./pages/crm/Cashier'));
const Lab = lazyWithRetry(() => import('./pages/crm/Lab'));
const Staff = lazyWithRetry(() => import('./pages/crm/Staff'));
const PriceList = lazyWithRetry(() => import('./pages/crm/PriceList'));
const Promotions = lazyWithRetry(() => import('./pages/crm/Promotions'));
const Inventory = lazyWithRetry(() => import('./pages/crm/Inventory'));
const StockRules = lazyWithRetry(() => import('./pages/crm/StockRules'));
const Marketing = lazyWithRetry(() => import('./pages/crm/Marketing'));
const MedicalCard = lazyWithRetry(() => import('./pages/crm/MedicalCard'));
const ICD10 = lazyWithRetry(() => import('./pages/crm/ICD10'));
const Visits = lazyWithRetry(() => import('./pages/crm/Visits'));
const Documents = lazyWithRetry(() => import('./pages/crm/Documents'));
const Reminders = lazyWithRetry(() => import('./pages/crm/Reminders'));
const Workflows = lazyWithRetry(() => import('./pages/crm/Workflows'));
const DentalChart = lazyWithRetry(() => import('./pages/crm/DentalChart'));
const TreatmentPlans = lazyWithRetry(() => import('./pages/crm/TreatmentPlans'));
const ClinicSettings = lazyWithRetry(() => import('./pages/crm/ClinicSettings'));
const ClinicBilling = lazyWithRetry(() => import('./pages/crm/ClinicBilling'));
const PatientInbox = lazyWithRetry(() => import('./pages/crm/PatientInbox'));
const IntegrationsMessaging = lazyWithRetry(() => import('./pages/clinic/IntegrationMessaging'));

const Shop = lazyWithRetry(() => import('./pages/shop/Shop'));
const ShopProduct = lazyWithRetry(() => import('./pages/shop/ShopProduct'));
const ShopCheckout = lazyWithRetry(() => import('./pages/shop/ShopCheckout'));
const ShopOrders = lazyWithRetry(() => import('./pages/shop/ShopOrders'));
const ShopFavorites = lazyWithRetry(() => import('./pages/shop/ShopFavorites'));
const ShopSuppliers = lazyWithRetry(() => import('./pages/shop/ShopSuppliers'));

const School = lazyWithRetry(() => import('./pages/school/School'));
const SchoolCourse = lazyWithRetry(() => import('./pages/school/SchoolCourse'));
const SchoolWorkspace = lazyWithRetry(() => import('./pages/school/SchoolWorkspace'));

const ShopAdmin = lazyWithRetry(() => import('./pages/admin/ShopAdmin'));
const SchoolAdmin = lazyWithRetry(() => import('./pages/admin/SchoolAdmin'));
const LegalLayout = lazyWithRetry(() => import('./pages/legal/LegalLayout'));
const PartnerLegal = lazyWithRetry(() => import('./pages/partner/PartnerLegal'));
const MyClinics = lazyWithRetry(() => import('./pages/MyClinics'));
const SupplierWorkspace = lazyWithRetry(() => import('./pages/supplier/SupplierWorkspace'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'))
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'));

function PageLoader() { return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-dv-gold/30 border-t-dv-gold" /></div>; }
function guarded(page: string, node: React.ReactNode) { return <RequirePage page={page}><Suspense fallback={<PageLoader />}>{node}</Suspense></RequirePage>; }

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <Providers>
            <Routes>
              <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
              <Route path="/onboarding" element={<Suspense fallback={<PageLoader />}><Onboarding /></Suspense>} />
              <Route path="/organizations/new" element={<Navigate to="/onboarding?mode=create" replace />} />
              <Route path="/organizations/join" element={<Navigate to="/onboarding?mode=join" replace />} />
              <Route path="/invitations" element={<Navigate to="/onboarding?mode=join" replace />} />
              <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
              <Route path="/book/discover" element={<Suspense fallback={<PageLoader />}><PublicBookingDiscovery /></Suspense>} />
              <Route path="/diagnostics/discover" element={<Suspense fallback={<PageLoader />}><PublicDiagnosticsDiscovery /></Suspense>} />
              <Route path="/book/:clinicId" element={<Suspense fallback={<PageLoader />}><PublicBooking /></Suspense>} />
              <Route path="/sign/:token" element={<Suspense fallback={<PageLoader />}><DocumentSign /></Suspense>} />
              <Route path="/plan/:releaseId" element={<Suspense fallback={<PageLoader />}><TreatmentPresentation /></Suspense>} />
              <Route path="/register-diagnostics" element={<Suspense fallback={<PageLoader />}><DiagnosticsRegister /></Suspense>} />
              <Route path="/patient-portal" element={<Suspense fallback={<PageLoader />}><PatientPortal /></Suspense>} />
              <Route path="/my-clinics" element={<Suspense fallback={<PageLoader />}><MyClinics /></Suspense>} />
              <Route path="/" element={<IntelligenceLayout />}>
                <Route index element={<Suspense fallback={<PageLoader />}><Welcome /></Suspense>} />
                {/* Canonical Master Spec v5 aliases. These preserve the existing
                    implementations while moving the public IA toward contextual cabinets. */ }
                <Route path="home" element={<Navigate to="/ai" replace />} />
                <Route path="context" element={<Navigate to="/ai" replace />} />
                <Route path="practice" element={<Navigate to="/crm/schedule" replace />} />
                <Route path="practice/today" element={<Navigate to="/crm/schedule" replace />} />
                <Route path="practice/calendar" element={<Navigate to="/crm/schedule" replace />} />
                <Route path="practice/patients" element={<Navigate to="/crm/patients" replace />} />
                <Route path="practice/cases/:caseId" element={<Navigate to="/crm/cases" replace />} />
                <Route path="practice/odontogram" element={<Navigate to="/crm/dental-chart" replace />} />
                <Route path="practice/treatment-plans" element={<Navigate to="/crm/treatment-plans" replace />} />
                <Route path="practice/appointments" element={<Navigate to="/crm/schedule" replace />} />
                <Route path="practice/diagnostics" element={<Navigate to="/diagnostics" replace />} />
                <Route path="practice/lab-orders" element={<Navigate to="/crm/lab" replace />} />
                <Route path="practice/inventory" element={<Navigate to="/crm/inventory" replace />} />
                <Route path="practice/documents" element={<Navigate to="/crm/documents" replace />} />
                <Route path="practice/communications" element={<Navigate to="/crm/patient-inbox" replace />} />
                <Route path="practice/finance" element={<Navigate to="/crm/cashier" replace />} />
                <Route path="practice/team" element={<Navigate to="/crm/staff" replace />} />
                <Route path="practice/branches" element={<Navigate to="/settings" replace />} />
                <Route path="medical-lab" element={<Navigate to="/diagnostics/lab?workspace=medical-lab" replace />} />
                <Route path="dental-lab" element={<Navigate to="/diagnostics/lab?workspace=dental-lab" replace />} />
                <Route path="business" element={<Navigate to="/supplier" replace />} />
                <Route path="academy" element={<Navigate to="/school" replace />} />
                <Route path="laboratories" element={<Navigate to="/diagnostics/labs" replace />} />
                <Route path="professional" element={<Navigate to="/profile" replace />} />
                {/* Master Spec cabinet consolidation: target routes resolve to existing canonical workflows. */ }
                <Route path="discover" element={<Navigate to="/" replace />} />
                <Route path="organizations" element={<Navigate to="/settings" replace />} />
                <Route path="organizations/:organizationId" element={<Navigate to="/settings" replace />} />
                <Route path="professionals/:professionalId" element={<Navigate to="/profile" replace />} />
                <Route path="services/:serviceId" element={<Navigate to="/shop" replace />} />
                <Route path="tasks" element={<Navigate to="/ai" replace />} />
                <Route path="search" element={<Navigate to="/ai" replace />} />
                <Route path="activity" element={<Navigate to="/audit" replace />} />

                <Route path="practice/patients/:patientId" element={<Navigate to="/crm/patients" replace />} />
                <Route path="practice/analytics" element={<Navigate to="/analytics" replace />} />

                <Route path="diagnostics/today" element={<Navigate to="/diagnostics/workspace" replace />} />
                <Route path="diagnostics/orders" element={<Navigate to="/diagnostics/referrals" replace />} />
                <Route path="diagnostics/worklist" element={<Navigate to="/diagnostics/referrals" replace />} />
                <Route path="diagnostics/studies/:studyId" element={<Navigate to="/diagnostics/results" replace />} />
                <Route path="diagnostics/reports" element={<Navigate to="/diagnostics/results" replace />} />
                <Route path="diagnostics/ai" element={<Navigate to="/ai" replace />} />
                <Route path="diagnostics/services" element={<Navigate to="/diagnostics/settings" replace />} />
                <Route path="diagnostics/schedule" element={<Navigate to="/diagnostics/calendar" replace />} />
                <Route path="diagnostics/rooms" element={<Navigate to="/diagnostics/settings" replace />} />
                <Route path="diagnostics/modalities" element={<Navigate to="/diagnostics/settings" replace />} />
                <Route path="diagnostics/staff" element={<Navigate to="/diagnostics/settings" replace />} />
                <Route path="diagnostics/branches" element={<Navigate to="/settings" replace />} />
                <Route path="diagnostics/finance" element={<Navigate to="/diagnostics/workspace" replace />} />
                <Route path="diagnostics/analytics" element={<Navigate to="/diagnostics/statistics" replace />} />
                <Route path="diagnostics/viewer/:studyId" element={<Navigate to="/diagnostics/results" replace />} />

                <Route path="medical-lab/today" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/orders" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/specimens" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/worklist" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/processing" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/results" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/results/:resultId" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/clients" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/tests" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/panels" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/quality" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/equipment" element={<Navigate to="/medical-lab" replace />} />
                <Route path="medical-lab/staff" element={<Navigate to="/settings" replace />} />
                <Route path="medical-lab/branches" element={<Navigate to="/settings" replace />} />
                <Route path="medical-lab/finance" element={<Navigate to="/diagnostics/workspace" replace />} />
                <Route path="medical-lab/analytics" element={<Navigate to="/analytics" replace />} />
                <Route path="medical-lab/settings" element={<Navigate to="/settings" replace />} />

                <Route path="dental-lab/today" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/inbox" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/cases" element={<Navigate to="/crm/lab" replace />} />
                <Route path="dental-lab/cases/:caseId" element={<Navigate to="/crm/lab" replace />} />
                <Route path="dental-lab/production" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/workstations" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/design" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/cadcam" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/qc" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/remakes" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/shipping" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/clients" element={<Navigate to="/dental-lab" replace />} />
                <Route path="dental-lab/catalog" element={<Navigate to="/shop" replace />} />
                <Route path="dental-lab/materials" element={<Navigate to="/shop" replace />} />
                <Route path="dental-lab/inventory" element={<Navigate to="/crm/inventory" replace />} />
                <Route path="dental-lab/invoices" element={<Navigate to="/crm/cashier" replace />} />
                <Route path="dental-lab/finance" element={<Navigate to="/diagnostics/workspace" replace />} />
                <Route path="dental-lab/analytics" element={<Navigate to="/analytics" replace />} />
                <Route path="dental-lab/staff" element={<Navigate to="/settings" replace />} />
                <Route path="dental-lab/settings" element={<Navigate to="/settings" replace />} />

                <Route path="business/today" element={<Navigate to="/supplier" replace />} />
                <Route path="business/catalog" element={<Navigate to="/shop" replace />} />
                <Route path="business/products" element={<Navigate to="/supplier" replace />} />
                <Route path="business/inventory" element={<Navigate to="/supplier" replace />} />
                <Route path="business/orders" element={<Navigate to="/supplier" replace />} />
                <Route path="business/fulfillment" element={<Navigate to="/supplier" replace />} />
                <Route path="business/customers" element={<Navigate to="/supplier" replace />} />
                <Route path="business/pricing" element={<Navigate to="/supplier" replace />} />
                <Route path="business/promotions" element={<Navigate to="/supplier" replace />} />
                <Route path="business/finance" element={<Navigate to="/supplier" replace />} />
                <Route path="business/analytics" element={<Navigate to="/analytics" replace />} />
                <Route path="business/team" element={<Navigate to="/supplier" replace />} />
                <Route path="business/settings" element={<Navigate to="/settings" replace />} />

                <Route path="academy/workspace" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/courses" element={<Navigate to="/school" replace />} />
                <Route path="academy/courses/:courseId" element={<Suspense fallback={<PageLoader />}><SchoolCourse /></Suspense>} />
                <Route path="academy/students" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/content" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/assessments" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/certificates" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/schedule" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/finance" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/analytics" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/team" element={<Navigate to="/school/workspace" replace />} />
                <Route path="academy/settings" element={<Navigate to="/settings" replace />} />

                <Route path="professional/profile" element={<Navigate to="/profile" replace />} />
                <Route path="professional/credentials" element={<Navigate to="/profile" replace />} />
                <Route path="professional/portfolio" element={<Navigate to="/profile" replace />} />
                <Route path="jobs/matches" element={<Navigate to="/jobs" replace />} />
                <Route path="jobs/applications" element={<Navigate to="/jobs" replace />} />
                <Route path="jobs/messages" element={<Navigate to="/jobs" replace />} />
                <Route path="employer" element={<Navigate to="/jobs" replace />} />
                <Route path="employer/vacancies" element={<Navigate to="/jobs" replace />} />
                <Route path="employer/candidates" element={<Navigate to="/jobs" replace />} />
                <Route path="employer/hiring" element={<Navigate to="/jobs" replace />} />

                <Route path="dashboard" element={<Navigate to="/" replace />} />
                <Route path="intelligence" element={<Navigate to="/ai" replace />} />
                <Route path="ai" element={<Suspense fallback={<PageLoader />}><AIWorkspaceIndex /></Suspense>} />
                <Route path="analytics" element={guarded('analytics', <Analytics />)} />
                <Route path="settings" element={guarded('settings', <SettingsPage />)} />
                <Route path="help" element={<Suspense fallback={<PageLoader />}><Help /></Suspense>} />
                <Route path="notifications" element={guarded('settings', <NotificationPreferences />)} />
                <Route path="admin" element={guarded('admin', <SuperAdmin />)} />
                {/* Platform console deep-links: these are SuperAdmin tabs, not separate pages. */}
                <Route path="ai-governance" element={guarded('admin', <Navigate to="/admin?tab=ai-governance" replace />)} />
                <Route path="platform-finance" element={guarded('admin', <Navigate to="/admin?tab=platform-finance" replace />)} />
                <Route path="ops" element={guarded('admin', <Navigate to="/admin?tab=ops" replace />)} />
                <Route path="quality" element={guarded('admin', <Navigate to="/admin?tab=quality" replace />)} />
                <Route path="support" element={guarded('admin', <Navigate to="/admin?tab=support" replace />)} />
                <Route path="bi" element={guarded('bi', <BIWorkspace />)} />
                <Route path="security" element={guarded('security', <SecurityCompliance />)} />
                <Route path="audit" element={guarded('audit', <AuditLog />)} />
                <Route path="agent-activity" element={guarded('agent-activity', <AgentActivity />)} />
                <Route path="ai-approvals" element={guarded('ai-approvals', <AiApprovals />)} />
                <Route path="backup" element={guarded('backup', <Backup />)} />
                <Route path="profile" element={guarded('profile', <Profile />)} />
                <Route path="supplier" element={<Suspense fallback={<PageLoader />}><SupplierWorkspace /></Suspense>} />
                <Route path="jobs" element={<Suspense fallback={<PageLoader />}><Jobs /></Suspense>} />
                <Route path="community" element={<Suspense fallback={<PageLoader />}><Community /></Suspense>} />
                <Route path="demo" element={<Suspense fallback={<PageLoader />}><Demo /></Suspense>} />
                <Route path="pricing" element={<Suspense fallback={<PageLoader />}><Pricing /></Suspense>} />
                <Route path="terms" element={<Suspense fallback={<PageLoader />}><Terms /></Suspense>} />
                <Route path="privacy" element={<Suspense fallback={<PageLoader />}><Privacy /></Suspense>} />
                <Route path="crm/schedule" element={guarded('schedule', <Schedule />)} />
                <Route path="crm/patients" element={guarded('patients', <Patients />)} />
                <Route path="crm/cases" element={guarded('treatment-plans', <ClinicalCaseWorkspace />)} />
                <Route path="crm/cashier" element={guarded('cashier', <Cashier />)} />
                <Route path="crm/pricelist" element={guarded('pricelist', <PriceList />)} />
                <Route path="crm/lab" element={guarded('lab', <Lab />)} />
                <Route path="crm/inventory" element={guarded('inventory', <Inventory />)} />
                <Route path="crm/stock-rules" element={guarded('inventory', <StockRules />)} />
                <Route path="crm/marketing" element={guarded('promotions', <Marketing />)} />
                <Route path="crm/promotions" element={guarded('promotions', <Promotions />)} />
                <Route path="crm/staff" element={guarded('staff', <Staff />)} />
                <Route path="crm/medical-card" element={guarded('medical-card', <MedicalCard />)} />
                <Route path="crm/icd10" element={guarded('icd10', <ICD10 />)} />
                <Route path="crm/visits" element={guarded('visits', <Visits />)} />
                <Route path="crm/documents" element={guarded('documents', <Documents />)} />
                <Route path="crm/reminders" element={guarded('reminders', <Reminders />)} />
                <Route path="crm/workflow" element={guarded('workflow', <Workflows />)} />
                <Route path="crm/dental-chart" element={guarded('dental-chart', <DentalChart />)} />
                <Route path="crm/treatment-plans" element={guarded('treatment-plans', <TreatmentPlans />)} />
                <Route path="crm/finance" element={<Navigate to="/crm/cashier" replace />} />
                <Route path="crm/clinic-settings" element={guarded('clinic-settings', <ClinicSettings />)} />
                <Route path="crm/billing" element={guarded('billing', <ClinicBilling />)} />
                <Route path="crm/patient-inbox" element={guarded('patient-inbox', <PatientInbox />)} />
                <Route path="crm/patient-inbox/:id" element={guarded('patient-inbox', <PatientInbox />)} />
                <Route path="crm/integrations/messaging" element={guarded('clinic-settings', <IntegrationsMessaging />)} />
                <Route path="shop" element={<Suspense fallback={<PageLoader />}><Shop /></Suspense>} />
                <Route path="shop/:id" element={<Suspense fallback={<PageLoader />}><ShopProduct /></Suspense>} />
                <Route path="shop/checkout" element={<Suspense fallback={<PageLoader />}><ShopCheckout /></Suspense>} />
                <Route path="shop/orders" element={<Suspense fallback={<PageLoader />}><ShopOrders /></Suspense>} />
                <Route path="shop/favorites" element={<Suspense fallback={<PageLoader />}><ShopFavorites /></Suspense>} />
                <Route path="shop/suppliers" element={<Suspense fallback={<PageLoader />}><ShopSuppliers /></Suspense>} />
                <Route path="diagnostics" element={<Suspense fallback={<PageLoader />}><DiagnosticsLayout /></Suspense>}>
                  <Route index element={<Suspense fallback={<PageLoader />}><DiagnosticsDashboard /></Suspense>} />
                  <Route path="referrals" element={<Suspense fallback={<PageLoader />}><ReferralList /></Suspense>} />
                  <Route path="referrals/new" element={<Suspense fallback={<PageLoader />}><ReferralForm /></Suspense>} />
                  <Route path="referrals/:id" element={<Suspense fallback={<PageLoader />}><ReferralDetail /></Suspense>} />
                  <Route path="centers" element={<Suspense fallback={<PageLoader />}><CenterList /></Suspense>} />
                  <Route path="labs" element={<Suspense fallback={<PageLoader />}><LabList /></Suspense>} />
                  <Route path="laboratories" element={<Navigate to="/diagnostics/labs" replace />} />
                  <Route path="patients" element={<Suspense fallback={<PageLoader />}><DiagnosticPatients /></Suspense>} />
                  <Route path="results" element={<Suspense fallback={<PageLoader />}><ResultList /></Suspense>} />
                  <Route path="calendar" element={<Suspense fallback={<PageLoader />}><DiagnosticCalendar /></Suspense>} />
                  <Route path="statistics" element={<Suspense fallback={<PageLoader />}><DiagnosticStatistics /></Suspense>} />
                  <Route path="settings" element={<Suspense fallback={<PageLoader />}><DiagnosticSettings /></Suspense>} />
                  <Route path="center" element={<Suspense fallback={<PageLoader />}><CenterDashboard /></Suspense>} />
                  <Route path="lab" element={<Suspense fallback={<PageLoader />}><LabDashboard /></Suspense>} />
                  <Route path="workspace" element={<Suspense fallback={<PageLoader />}><WorkspaceEntry /></Suspense>} />
                  <Route path="registration-requests" element={<Suspense fallback={<PageLoader />}><RegistrationRequests /></Suspense>} />
                  <Route path="registrations" element={<Navigate to="/diagnostics/registration-requests" replace />} />
                  <Route path="center-dashboard" element={<Navigate to="/diagnostics/center" replace />} />
                  <Route path="lab-dashboard" element={<Navigate to="/diagnostics/lab" replace />} />
                </Route>
                <Route path="school" element={<Suspense fallback={<PageLoader />}><School /></Suspense>} />
                <Route path="school/course/:id" element={<Suspense fallback={<PageLoader />}><SchoolCourse /></Suspense>} />
                <Route path="school/workspace" element={<Suspense fallback={<PageLoader />}><SchoolWorkspace /></Suspense>} />
                <Route path="school-workspace" element={<Navigate to="/school/workspace" replace />} />
                <Route path="admin/shop" element={guarded('admin', <ShopAdmin />)} />
                <Route path="admin/school" element={guarded('admin', <SchoolAdmin />)} />
                <Route path="legal" element={<Suspense fallback={<PageLoader />}><LegalLayout /></Suspense>} />
                <Route path="partner/legal" element={<Suspense fallback={<PageLoader />}><PartnerLegal /></Suspense>} />
                <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
              </Route>
            </Routes>
          </Providers>
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
reportWebVitals();
