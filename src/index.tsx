import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ds';
import { AIWorkspaceIndex } from './components/intelligence/AIWorkspaceIndex';
import IntelligenceLayout from './layouts/IntelligenceLayout';

import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import PublicBooking from './pages/auth/PublicBooking';
import DocumentSign from './pages/auth/DocumentSign';
import './styles/global.css';
import { reportWebVitals } from './utils/vitals';

// Platform pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AITeam = lazy(() => import('./pages/AITeam'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const HiddenSupplierOps = lazy(() => import('./pages/ops/HiddenSupplierOps'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Backup = lazy(() => import('./pages/Backup'));
const Analytics = lazy(() => import('./pages/Analytics'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Community = lazy(() => import('./pages/Community'));
const Demo = lazy(() => import('./pages/Demo'));
const Pricing = lazy(() => import('./pages/Pricing'));

// CRM sub-app pages
const Schedule = lazy(() => import('./pages/crm/Schedule'));
const Patients = lazy(() => import('./pages/crm/Patients'));
const Cashier = lazy(() => import('./pages/crm/Cashier'));
const Lab = lazy(() => import('./pages/crm/Lab'));
const Staff = lazy(() => import('./pages/crm/Staff'));
const PriceList = lazy(() => import('./pages/crm/PriceList'));
const Promotions = lazy(() => import('./pages/crm/Promotions'));
const Inventory = lazy(() => import('./pages/crm/Inventory'));
const MedicalCard = lazy(() => import('./pages/crm/MedicalCard'));
const ICD10 = lazy(() => import('./pages/crm/ICD10'));
const Visits = lazy(() => import('./pages/crm/Visits'));
const Documents = lazy(() => import('./pages/crm/Documents'));
const Reminders = lazy(() => import('./pages/crm/Reminders'));
const DentalChart = lazy(() => import('./pages/crm/DentalChart'));
const TreatmentPlans = lazy(() => import('./pages/crm/TreatmentPlans'));
const ClinicSettings = lazy(() => import('./pages/crm/ClinicSettings'));

// Shop sub-app pages
const Shop = lazy(() => import('./pages/shop/Shop'));
const ShopProduct = lazy(() => import('./pages/shop/ShopProduct'));
const ShopCheckout = lazy(() => import('./pages/shop/ShopCheckout'));
const ShopOrders = lazy(() => import('./pages/shop/ShopOrders'));
const ShopFavorites = lazy(() => import('./pages/shop/ShopFavorites'));
const ShopSuppliers = lazy(() => import('./pages/shop/ShopSuppliers'));

// School sub-app pages
const School = lazy(() => import('./pages/school/School'));
const SchoolCourse = lazy(() => import('./pages/school/SchoolCourse'));

// Platform content-management (superadmin) pages
const ShopAdmin = lazy(() => import('./pages/admin/ShopAdmin'));
const SchoolAdmin = lazy(() => import('./pages/admin/SchoolAdmin'));

// Workspace selection
const MyClinics = lazy(() => import('./pages/MyClinics'));

// Supplier self-service workspace
const SupplierWorkspace = lazy(() => import('./pages/supplier/SupplierWorkspace'));

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
