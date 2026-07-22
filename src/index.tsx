import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ds';
import { AIWorkspaceIndex } from './components/intelligence/AIWorkspaceIndex';
import IntelligenceLayout from './layouts/IntelligenceLayout';
import { lazyWithRetry } from '@/utils/lazyWithRetry';

import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import PublicBooking from './pages/auth/PublicBooking';
import DocumentSign from './pages/auth/DocumentSign';
import './styles/global.css';
import { reportWebVitals } from './utils/vitals';

// Platform pages
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const AITeam = lazyWithRetry(() => import('./pages/AITeam'));
const SuperAdmin = lazyWithRetry(() => import('./pages/SuperAdmin'));
const HiddenSupplierOps = lazyWithRetry(() => import('./pages/ops/HiddenSupplierOps'));
const AuditLog = lazyWithRetry(() => import('./pages/AuditLog'));
const Backup = lazyWithRetry(() => import('./pages/Backup'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const SettingsPage = lazyWithRetry(() => import('./pages/Settings'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Jobs = lazyWithRetry(() => import('./pages/Jobs'));
const Community = lazyWithRetry(() => import('./pages/Community'));
const Demo = lazyWithRetry(() => import('./pages/Demo'));
const Pricing = lazyWithRetry(() => import('./pages/Pricing'));

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

// Workspace selection
const MyClinics = lazyWithRetry(() => import('./pages/MyClinics'));

// Supplier self-service workspace
const SupplierWorkspace = lazyWithRetry(() => import('./pages/supplier/SupplierWorkspace'));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C9A96E]/30 border-t-[#C9A96E]" />
    </div>
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
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/book/:clinicId" element={<PublicBooking />} />
                <Route path="/sign/:token" element={<DocumentSign />} />

                {/* Workspace selection (no active clinic) */}
                <Route path="/my-clinics" element={<Suspense fallback={<PageLoader />}><MyClinics /></Suspense>} />

                {/* AI-First Intelligence Layout — Main entry point after login */}
                <Route path="/" element={<IntelligenceLayout />}>
                  <Route index element={<Suspense fallback={<PageLoader />}><AIWorkspaceIndex /></Suspense>} />
                  <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                  <Route path="intelligence" element={<Navigate to="/" replace />} />

                  {/* Platform pages */}
                  <Route path="ai" element={<Suspense fallback={<PageLoader />}><AITeam /></Suspense>} />
                  <Route path="analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
                  <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
                  <Route path="admin" element={<Suspense fallback={<PageLoader />}><SuperAdmin /></Suspense>} />
                  {/* Hidden ops console — not linked in nav. SUPERADMIN + ops key required. */}
                  <Route path="x-ops/sg" element={<Suspense fallback={<PageLoader />}><HiddenSupplierOps /></Suspense>} />
                  <Route path="audit" element={<Suspense fallback={<PageLoader />}><AuditLog /></Suspense>} />
                  <Route path="backup" element={<Suspense fallback={<PageLoader />}><Backup /></Suspense>} />
                  <Route path="profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
                  <Route path="supplier" element={<Suspense fallback={<PageLoader />}><SupplierWorkspace /></Suspense>} />
                  <Route path="jobs" element={<Suspense fallback={<PageLoader />}><Jobs /></Suspense>} />
                  <Route path="community" element={<Suspense fallback={<PageLoader />}><Community /></Suspense>} />
                  <Route path="demo" element={<Suspense fallback={<PageLoader />}><Demo /></Suspense>} />
                  <Route path="pricing" element={<Suspense fallback={<PageLoader />}><Pricing /></Suspense>} />

                  {/* CRM sub-app — under IntelligenceLayout sidebar */}
                  <Route path="crm/schedule" element={<Suspense fallback={<PageLoader />}><Schedule /></Suspense>} />
                  <Route path="crm/patients" element={<Suspense fallback={<PageLoader />}><Patients /></Suspense>} />
                  <Route path="crm/cashier" element={<Suspense fallback={<PageLoader />}><Cashier /></Suspense>} />
                  <Route path="crm/pricelist" element={<Suspense fallback={<PageLoader />}><PriceList /></Suspense>} />
                  <Route path="crm/lab" element={<Suspense fallback={<PageLoader />}><Lab /></Suspense>} />
                  <Route path="crm/inventory" element={<Suspense fallback={<PageLoader />}><Inventory /></Suspense>} />
                  <Route path="crm/promotions" element={<Suspense fallback={<PageLoader />}><Promotions /></Suspense>} />
                  <Route path="crm/staff" element={<Suspense fallback={<PageLoader />}><Staff /></Suspense>} />
                  <Route path="crm/medical-card" element={<Suspense fallback={<PageLoader />}><MedicalCard /></Suspense>} />
                  <Route path="crm/icd10" element={<Suspense fallback={<PageLoader />}><ICD10 /></Suspense>} />
                  <Route path="crm/visits" element={<Suspense fallback={<PageLoader />}><Visits /></Suspense>} />
                  <Route path="crm/documents" element={<Suspense fallback={<PageLoader />}><Documents /></Suspense>} />
                  <Route path="crm/reminders" element={<Suspense fallback={<PageLoader />}><Reminders /></Suspense>} />
                  <Route path="crm/dental-chart" element={<Suspense fallback={<PageLoader />}><DentalChart /></Suspense>} />
                  <Route path="crm/treatment-plans" element={<Suspense fallback={<PageLoader />}><TreatmentPlans /></Suspense>} />
                  <Route path="crm/finance" element={<Suspense fallback={<PageLoader />}><Cashier /></Suspense>} />
                  <Route path="crm/clinic-settings" element={<Suspense fallback={<PageLoader />}><ClinicSettings /></Suspense>} />
                  <Route path="crm/billing" element={<Suspense fallback={<PageLoader />}><ClinicBilling /></Suspense>} />

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

                  {/* Superadmin content management */}
                  <Route path="shop/admin" element={<Suspense fallback={<PageLoader />}><ShopAdmin /></Suspense>} />
                  <Route path="school/admin" element={<Suspense fallback={<PageLoader />}><SchoolAdmin /></Suspense>} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
          </Providers>
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
  reportWebVitals();
}
