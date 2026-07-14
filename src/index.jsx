import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext.jsx';
import { AppLayout } from './layouts/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './pages/Login';
import './styles/global.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Patients = lazy(() => import('./pages/Patients'));
const Cashier = lazy(() => import('./pages/Cashier'));
const Lab = lazy(() => import('./pages/Lab'));
const AITeam = lazy(() => import('./pages/AITeam'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const Staff = lazy(() => import('./pages/Staff'));
const PriceList = lazy(() => import('./pages/PriceList'));

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
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                  <Route path="schedule" element={<Suspense fallback={<PageLoader />}><Schedule /></Suspense>} />
                  <Route path="patients" element={<Suspense fallback={<PageLoader />}><Patients /></Suspense>} />
                  <Route path="cashier" element={<Suspense fallback={<PageLoader />}><Cashier /></Suspense>} />
                  <Route path="pricelist" element={<Suspense fallback={<PageLoader />}><PriceList /></Suspense>} />
                  <Route path="lab" element={<Suspense fallback={<PageLoader />}><Lab /></Suspense>} />
                  <Route path="ai" element={<Suspense fallback={<PageLoader />}><AITeam /></Suspense>} />
                  <Route path="staff" element={<Suspense fallback={<PageLoader />}><Staff /></Suspense>} />
                  <Route path="admin" element={<Suspense fallback={<PageLoader />}><SuperAdmin /></Suspense>} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
