import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OnboardingPage from '../pages/OnboardingPage';

/**
 * Wraps inventory routes:
 *  - Not loaded yet  → loading spinner
 *  - No session      → redirect to /login
 *  - Session but onboarding incomplete → show OnboardingPage (inline, not redirect)
 *  - Session + onboarded → render children
 */
export default function RequireAuth() {
  const { session, onboardStatus, loading } = useAuth();

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Restoring session…" />
        <div className="state-text">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (onboardStatus === 'pending') {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Setting up shop…" />
        <div className="state-text">Setting up your shop…</div>
      </div>
    );
  }

  if (onboardStatus === 'failed') {
    return <OnboardingPage />;
  }

  return <Outlet />;
}
