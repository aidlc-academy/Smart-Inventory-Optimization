import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="state-container">
      <div className="state-icon">🔍</div>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          marginBottom: 8,
          color: 'var(--color-gold-bright)',
          letterSpacing: '-0.02em',
        }}
      >
        404 — Page Not Found
      </h1>
      <div className="state-text">The page you are looking for does not exist.</div>
      <Link to="/" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
}
