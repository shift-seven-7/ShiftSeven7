import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import RequireAccess from './components/RequireAccess';
import Home from './pages/Home';
import StaffPage from './pages/StaffPage';
import PostsPage from './pages/PostsPage';
import ShiftTemplatesPage from './pages/ShiftTemplatesPage';
import SchedulePage from './pages/SchedulePage';
import SettingsPage from './pages/SettingsPage';
import SmartSchedulePage from './pages/SmartSchedulePage';
import PublishedSchedulePage from './pages/PublishedSchedulePage';
import ShiftRequestPage from './pages/ShiftRequestPage';
import UnstaffedShiftsPage from './pages/UnstaffedShiftsPage';
import ConstraintsReportPage from './pages/ConstraintsReportPage';
import StaffingRequirementsPage from './pages/StaffingRequirementsPage';
import EmployeeRequestsPage from './pages/EmployeeRequestsPage';
import RequestsManagementPage from './pages/RequestsManagementPage';
import MyAreaPage from './pages/MyAreaPage';
import { ImpersonationProvider } from '@/lib/ImpersonationContext';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<RequireAccess />}>
          <Route path="/" element={<Home />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/shifts" element={<ShiftTemplatesPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/smart-schedule" element={<SmartSchedulePage />} />
          <Route path="/published-schedule" element={<PublishedSchedulePage />} />
          <Route path="/shift-request" element={<ShiftRequestPage />} />
          <Route path="/unstaffed-shifts" element={<UnstaffedShiftsPage />} />
          <Route path="/constraints-report" element={<ConstraintsReportPage />} />
          <Route path="/staffing-requirements" element={<StaffingRequirementsPage />} />
          <Route path="/my-area" element={<MyAreaPage />} />
          <Route path="/requests" element={<EmployeeRequestsPage />} />
          <Route path="/manage-requests" element={<RequestsManagementPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ImpersonationProvider>
            <AuthenticatedApp />
          </ImpersonationProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App