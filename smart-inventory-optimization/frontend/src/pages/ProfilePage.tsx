import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function ProfilePage() {
  const { user, shop, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Loading" />
        <div className="state-text">Loading profile…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="state-container">
        <div className="state-icon">⚠</div>
        <div className="state-text">Not signed in.</div>
      </div>
    );
  }

  const name  = shop?.owner_name ?? user.email ?? 'Account';
  const email = user.email ?? '—';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#9a80a0', marginBottom: 24 }}>
        <span>Workspace</span>
        <span style={{ opacity: 0.5, margin: '0 6px' }}>/</span>
        <span style={{ color: '#302336', fontWeight: 600 }}>Profile</span>
      </div>

      <h1 style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 28, fontWeight: 700, color: '#302336', marginBottom: 24,
      }}>
        Your Profile
      </h1>

      <div className="card" style={{ maxWidth: 480, padding: '32px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg,#D6B36A,#a8832a)',
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0,
          }}>
            {initials(name)}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#302336' }}>{name}</div>
            <div style={{ fontSize: 13, color: '#7a6080', marginTop: 2 }}>{email}</div>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #E0CEDE' }}>
          {[
            { label: 'Owner Name',  value: shop?.owner_name ?? '—' },
            { label: 'Shop Name',   value: shop?.shop_name  ?? '—' },
            { label: 'Email',       value: email },
            { label: 'Shop ID',     value: shop ? String(shop.shop_id) : '—' },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '13px 18px',
              background: i % 2 === 0 ? '#FFF8F0' : '#FFF0E5',
              borderBottom: i < 3 ? '1px solid #E0CEDE' : 'none',
            }}>
              <span style={{ fontSize: 13, color: '#7a6080', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 14, color: '#302336', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-primary"
          style={{ marginTop: 28, width: '100%', justifyContent: 'center', padding: '11px 0', borderRadius: 9 }}
        >
          Log out
        </button>
      </div>
    </>
  );
}
