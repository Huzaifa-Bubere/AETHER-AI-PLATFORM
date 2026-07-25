import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { useAuthStore } from './stores/authStore';
import { LoadingSpinner } from './components/ui/loading-spinner';

// Lazy load heavy components
import { lazy, Suspense } from 'react';

const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage').then(m => ({ default: m.PaymentSuccessPage })));
const ResumeAnalyzerPage = lazy(() => import('./pages/ResumeAnalyzerPage').then(m => ({ default: m.ResumeAnalyzerPage })));
const InterviewSetupPage = lazy(() => import('./pages/InterviewSetupPage').then(m => ({ default: m.InterviewSetupPage })));
const InterviewRoomPage = lazy(() => import('./pages/InterviewRoomPage').then(m => ({ default: m.InterviewRoomPage })));
const CodingInterviewPage = lazy(() => import('./pages/CodingInterviewPage').then(m => ({ default: m.CodingInterviewPage })));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then(m => ({ default: m.FeedbackPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
);

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public route wrapper
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Admin route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Check if user has admin role
  if (user?.auth?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/signup" element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        } />
        <Route path="/forgot-password" element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        } />
        <Route path="/reset-password" element={
          <PublicRoute>
            <ResetPasswordPage />
          </PublicRoute>
        } />
        <Route path="/admin/login" element={
          <Suspense fallback={<PageLoader />}>
            <AdminLoginPage />
          </Suspense>
        } />
        
        {/* Protected Routes */}
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <OnboardingPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <DashboardPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <ProfilePage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/subscription" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <SubscriptionPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/payment/success" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <PaymentSuccessPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/resume" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <ResumeAnalyzerPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <HistoryPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/interview-setup" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <InterviewSetupPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/interview-room" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <InterviewRoomPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/coding-interview" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <CodingInterviewPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/feedback/:id" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <FeedbackPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminDashboardPage />
            </Suspense>
          </AdminRoute>
        } />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <Toaster
        position="top-center"
        containerStyle={{
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />

    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}