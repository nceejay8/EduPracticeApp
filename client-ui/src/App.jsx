// App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardUI from './pages/DashboardUI';
import Admin from './pages/Admin';
import Practice from './pages/Practice';
import Analytics from './pages/Analytics';
import MockExams from './pages/MockExams';
import ExamRunner from './pages/ExamRunner';
import ExamResults from './pages/ExamResults';
import Profile from './pages/Profile';
import Layout from './pages/Layout';
import ProtectedRoute from './auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { LocalizationProvider } from './contexts/LocalizationContext';
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import NotFoundPage from './pages/NotFoundPage';

// Public auth pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';

import './App.css';

function App() {
  return (
    <LocalizationProvider>
      <AuthProvider>
        <UserProvider>
          <NotificationsProvider>
            <ErrorBoundary>
              <Router>
              <Routes>
                {/* Public Authentication Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Protected Routes - All routes require authentication */}
                {/* Unauthorized users are redirected to /login by ProtectedRoute */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<DashboardUI />} />
                    <Route path="/dashboard" element={<DashboardUI />} />
                    <Route path="/practice" element={<Practice />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/mock-exams" element={<MockExams />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/admin" element={<Admin />} />
                  </Route>
                  {/* Distraction-free exam routes (no sidebar) */}
                  <Route path="/exam/run" element={<ExamRunner />} />
                  <Route path="/exam/results/:attemptId" element={<ExamResults />} />
                </Route>

                {/* Unknown URLs (no matching protected child): NotFoundPage. Must stay last; do not add path="*" inside ProtectedRoute or guests would hit login instead of 404. */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </Router>
            </ErrorBoundary>
          </NotificationsProvider>
        </UserProvider>
      </AuthProvider>
    </LocalizationProvider>
  );
}

export default App;
