import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import SearchPage from './pages/SearchPage';
import ComponentDetailPage from './pages/ComponentDetailPage';
import ReplacementsPage from './pages/ReplacementsPage';
import ComparePage from './pages/ComparePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminIngestionPage from './pages/AdminIngestionPage';
import AdminDataPage from './pages/AdminDataPage';
import AdminApiUsagePage from './pages/AdminApiUsagePage';

function App() {
  return (
    <AppShell>
      <Routes>
        {/* Main routes */}
        <Route path="/" element={<SearchPage />} />
        <Route path="/component/:id" element={<ComponentDetailPage />} />
        <Route path="/replacements/:mpn" element={<ReplacementsPage />} />
        <Route path="/compare" element={<ComparePage />} />

        {/* Admin routes */}
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/ingestion" element={<AdminIngestionPage />} />
        <Route path="/admin/data" element={<AdminDataPage />} />
        <Route path="/admin/api-usage" element={<AdminApiUsagePage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
