import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/guards/ProtectedRoute';
import { AdminRoute } from './components/guards/AdminRoute';
import { AppLayout } from './components/layout/AppLayout';

import { CasesPage } from './pages/CasePage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EvidenceLibraryPage } from './pages/EvidenceLibraryPage';
import { EvidenceDetailPage } from './pages/EvidenceDetailPage';
import { UploadEvidencePage } from './pages/UploadEvidencePage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { CustodyListPage } from './pages/CustodyListPage';
import { CustodyDetailPage } from './pages/CustodyDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              className: 'dark:bg-slate-800 dark:text-white',
              success: { style: { background: '#10b981', color: '#fff' } },
              error: { style: { background: '#ef4444', color: '#fff' } },
            }}
          />
          <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root Redirect to Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            <Route path="/evidence" element={<EvidenceLibraryPage />} />
            <Route path="/evidence/:id" element={<EvidenceDetailPage />} />
            <Route path="/upload" element={<UploadEvidencePage />} />
            <Route path="/custody" element={<CustodyListPage />} />
            <Route path="/custody/evidence/:id" element={<CustodyDetailPage />} />

            {/* Admin-Only Routes */}
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <UsersManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <AdminRoute>
                  <AuditLogsPage />
                </AdminRoute>
              }
            />
          </Route>

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
