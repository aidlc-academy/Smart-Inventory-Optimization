import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OnboardingPage from '../pages/OnboardingPage';

/**
 * Guards all inventory routes.
 *
 * pending      → loading spinner (session restore or shop fetch in progress)
 * no session   → redirect to /login
 * needs_setup  → backend confirmed no shop exists yet → show OnboardingPage
 * failed       → transient error (network / 5xx) → show Retry (not onboarding form)
 * complete     → render children
 */
export default function RequireAuth() {
  const { session, onboardStatus, loading, retryOnboard } = useAuth();

  if (loading || onboardStatus === 'pending') {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Loading…" />
        <div className="state-text">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (onboardStatus === 'needs_setup') {
    return <OnboardingPage />;
  }

  if (onboardStatus === 'failed') {
    return (
      <div className="state-container">
        <div className="state-icon">⚠</div>
        <div className="state-text" role="alert">
          Could not connect to the server. Please check your connection and try again.
        </div>
        <button className="btn btn-primary" onClick={retryOnboard}>
          Retry
        </button>
      </div>
    );
  }

  return <Outlet />;
}
