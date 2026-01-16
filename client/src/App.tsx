import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import SearchPage from './pages/SearchPage';
import ComponentDetailPage from './pages/ComponentDetailPage';
import ReplacementsPage from './pages/ReplacementsPage';
import ComparePage from './pages/ComparePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminIngestionPage from './pages/AdminIngestionPage';
import AdminImportPage from './pages/AdminImportPage';
import AdminDataPage from './pages/AdminDataPage';
import AdminApiUsagePage from './pages/AdminApiUsagePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminPartsPage from './pages/AdminPartsPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected routes (any authenticated user) */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppShell><SearchPage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/component/:id" element={
          <ProtectedRoute>
            <AppShell><ComponentDetailPage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/replacements/:mpn" element={
          <ProtectedRoute>
            <AppShell><ReplacementsPage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/compare" element={
          <ProtectedRoute>
            <AppShell><ComparePage /></AppShell>
          </ProtectedRoute>
        } />

        {/* Admin-only routes */}
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin>
            <AppShell><AdminDashboardPage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/ingestion" element={
          <ProtectedRoute requireAdmin>
            <AppShell><AdminIngestionPage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/import" element={
          <ProtectedRoute requireAdmin>
            <AppShell><AdminImportPage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/data" element={
          <ProtectedRoute requireAdmin>
            <AppShell><AdminDataPage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/api-usage" element={
          <ProtectedRoute requireAdmin>
            <AppShell><AdminApiUsagePage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute requireAdmin>
            <AppShell><AdminUsersPage /></AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/parts" element={
          <ProtectedRoute requireAdmin>
            <AppShell><AdminPartsPage /></AppShell>
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}

export default App;
