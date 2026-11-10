import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Spinner } from './components/ui'

const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Auth').then(m => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Auth').then(m => ({ default: m.Register })))
const FeaturesPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.FeaturesPage })))
const PricingPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.PricingPage })))
const PrivacyPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.PrivacyPage })))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ResumeLab = lazy(() => import('./pages/ResumeLab'))
const JobMatch = lazy(() => import('./pages/JobMatch'))
const Recruiter = lazy(() => import('./pages/Recruiter'))
const InterviewPrep = lazy(() => import('./pages/InterviewPrep'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const Screening = lazy(() => import('./pages/Screening'))


function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32">
      <Spinner size={32} />
    </div>
  )
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#FBFCF5',
            color: '#2A1A1E',
            border: '1px solid #D3DBB8',
            borderRadius: '12px',
            fontSize: '0.875rem',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#5E8A3A', secondary: 'white' } },
          error: { iconTheme: { primary: '#C2294A', secondary: 'white' } },
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected */}
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/resume-lab" element={<AppLayout><ResumeLab /></AppLayout>} />
          <Route path="/job-match" element={<AppLayout><JobMatch /></AppLayout>} />
          <Route path="/recruiter" element={<AppLayout><Recruiter /></AppLayout>} />
          <Route path="/interview-prep" element={<AppLayout><InterviewPrep /></AppLayout>} />
          <Route path="/portfolio" element={<AppLayout><Portfolio /></AppLayout>} />
          <Route path="/analytics" element={<AppLayout><Analytics /></AppLayout>} />
          <Route path="/screening" element={<AppLayout><Screening /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />

          <Route path="/privacy" element={<PrivacyPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Suspense>
    </HashRouter>
  )
}
