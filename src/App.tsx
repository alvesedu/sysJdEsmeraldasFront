import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UnitsPage } from './pages/UnitsPage';
import { ResidentsPage } from './pages/ResidentsPage';
import { ChargesPage } from './pages/ChargesPage';
import { DefaultersPage } from './pages/DefaultersPage';
import { QuickEntryPage } from './pages/QuickEntryPage';
import { ImportsPage } from './pages/ImportsPage';
import { ReconciliationPage } from './pages/ReconciliationPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { PayablesPage } from './pages/PayablesPage';
import { ClosingsPage } from './pages/ClosingsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { AuditPage } from './pages/AuditPage';
import { ReportsPage } from './pages/ReportsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('auth_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/units" element={<UnitsPage />} />
        <Route path="/residents" element={<ResidentsPage />} />
        <Route path="/quick-entry" element={<QuickEntryPage />} />
        <Route path="/charges" element={<ChargesPage />} />
        <Route path="/defaulters" element={<DefaultersPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/reconciliation" element={<ReconciliationPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/payables" element={<PayablesPage />} />
        <Route path="/closings" element={<ClosingsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
    </Routes>
  );
}
