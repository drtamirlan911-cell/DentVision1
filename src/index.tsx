import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationsContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ds';
import { AIWorkspaceIndex } from './components/intelligence/AIWorkspaceIndex';
import IntelligenceLayout from './layouts/IntelligenceLayout';

import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import PublicBooking from './pages/auth/PublicBooking';
import DocumentSign from './pages/auth/DocumentSign';
import './styles/global.css';

// Platform pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AITeam = lazy(() => import('./pages/AITeam'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Backup = lazy(() => import('./pages/Backup'));
const Analytics = lazy(() => import('./pages/Analytics'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));

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

// Layouts
import { CrmLayout } from './layouts/services/CrmLayout';
import { ShopLayout } from './layouts/services/ShopLayout';
import { SchoolLayout } from './layouts/services/SchoolLayout';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

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
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
            <AuthProvider>
              <CartProvider>
              <NotificationProvider>
              <Routes>
                {/* Public / standalone routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/book/:clinicId" element={<PublicBooking />} />
                <Route path="/sign/:token" element={<DocumentSign />} />

                {/* AI-First Intelligence Layout - Main entry point after login */}
                <Route path="/" element={<IntelligenceLayout />}>
                  <Route index element={<Suspense fallback={<PageLoader />}><AIWorkspaceIndex /></Suspense>} />
                  
                  {/* Dashboard as child of Intelligence */}
                  <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                  <Route path="intelligence" element={<Navigate to="/" replace />} />
                  
                  {/* Platform pages */}
                  <Route path="ai" element={<Suspense fallback={<PageLoader />}><AITeam /></Suspense>} />
                  <Route path="analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
                  <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
                  <Route path="admin" element={<Suspense fallback={<PageLoader />}><SuperAdmin /></Suspense>} />
                  <Route path="audit" element={<Suspense fallback={<PageLoader />}><AuditLog /></Suspense>} />
                  <Route path="backup" element={<Suspense fallback={<PageLoader />}><Backup /></Suspense>} />
                  <Route path="profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
                  <Route path="shop/admin" element={<Suspense fallback={<PageLoader />}><ShopAdmin /></Suspense>} />
                  <Route path="school/admin" element={<Suspense fallback={<PageLoader />}><SchoolAdmin /></Suspense>} />
                </Route>

                {/* Workspace selection (no active clinic) */}
                <Route path="my-clinics" element={<Suspense fallback={<PageLoader />}><MyClinics /></Suspense>} />

                {/* CRM sub-app */}
                <Route path="crm" element={<CrmLayout />}>
                  <Route path="schedule" element={<Suspense fallback={<PageLoader />}><Schedule /></Suspense>} />
                  <Route path="patients" element={<Suspense fallback={<PageLoader />}><Patients /></Suspense>} />
                  <Route path="cashier" element={<Suspense fallback={<PageLoader />}><Cashier /></Suspense>} />
                  <Route path="pricelist" element={<Suspense fallback={<PageLoader />}><PriceList /></Suspense>} />
                  <Route path="lab" element={<Suspense fallback={<PageLoader />}><Lab /></Suspense>} />
                  <Route path="inventory" element={<Suspense fallback={<PageLoader />}><Inventory /></Suspense>} />
                  <Route path="promotions" element={<Suspense fallback={<PageLoader />}><Promotions /></Suspense>} />
                  <Route path="staff" element={<Suspense fallback={<PageLoader />}><Staff /></Suspense>} />
                  <Route path="medical-card" element={<Suspense fallback={<PageLoader />}><MedicalCard /></Suspense>} />
                  <Route path="icd10" element={<Suspense fallback={<PageLoader />}><ICD10 /></Suspense>} />
                  <Route path="visits" element={<Suspense fallback={<PageLoader />}><Visits /></Suspense>} />
                  <Route path="documents" element={<Suspense fallback={<PageLoader />}><Documents /></Suspense>} />
                </Route>

                {/* Shop sub-app */}
                <Route path="shop" element={<ShopLayout />}>
                  <Route index element={<Suspense fallback={<PageLoader />}><Shop /></Suspense>} />
                  <Route path=":id" element={<Suspense fallback={<PageLoader />}><ShopProduct /></Suspense>} />
                  <Route path="checkout" element={<Suspense fallback={<PageLoader />}><ShopCheckout /></Suspense>} />
                  <Route path="orders" element={<Suspense fallback={<PageLoader />}><ShopOrders /></Suspense>} />
                  <Route path="favorites" element={<Suspense fallback={<PageLoader />}><ShopFavorites /></Suspense>} />
                  <Route path="suppliers" element={<Suspense fallback={<PageLoader />}><ShopSuppliers /></Suspense>} />
                </Route>

                {/* School sub-app */}
                <Route path="school" element={<SchoolLayout />}>
                  <Route index element={<Suspense fallback={<PageLoader />}><School /></Suspense>} />
                  <Route path=":id" element={<Suspense fallback={<PageLoader />}><SchoolCourse /></Suspense>} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </NotificationProvider>
              </CartProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
