import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { onboard } from '../api/client';

/**
 * Shown when the backend confirms the user has no shop yet (needs_setup).
 * Calls completeOnboard() directly so the parent updates without a full re-fetch.
 */
export default function OnboardingPage() {
  const { session, completeOnboard } = useAuth();
  const [ownerName, setOwnerName] = useState('');
  const [shopName,  setShopName]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ownerName.trim()) { setError('Owner name is required.'); return; }
    if (!shopName.trim())  { setError('Shop name is required.'); return; }
    if (!session)          { setError('No active session. Please log in again.'); return; }

    setLoading(true);
    try {
      const result = await onboard(
        { owner_name: ownerName.trim(), shop_name: shopName.trim() },
        session.access_token
      );
      // Both 200 (already onboarded) and 201 (newly created) return the real shop
      completeOnboard({
        owner_id:   result.owner_id,
        shop_id:    result.shop_id,
        owner_name: result.owner_name,
        shop_name:  result.shop_name,
      });
    } catch (err: any) {
      setError(err.message ?? 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🏪</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
          Set up your shop
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(122,128,160,.8)', marginBottom: 20 }}>
          Enter your name and shop name to complete setup.
        </p>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={labelStyle}>
            Owner Name
            <input style={inputStyle} value={ownerName} onChange={e => setOwnerName(e.target.value)}
              placeholder="Your name" autoComplete="name" required />
          </label>
          <label style={labelStyle}>
            Shop Name
            <input style={inputStyle} value={shopName} onChange={e => setShopName(e.target.value)}
              placeholder="Your store name" autoComplete="organization" required />
          </label>

          {error && <div role="alert" style={errorStyle}>{error}</div>}

          <button type="submit" disabled={loading} style={submitBtn}>
            {loading ? 'Setting up…' : 'Finish Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#FFF8F0', padding: 16,
};
const card: React.CSSProperties = {
  background: '#FFF0E5', border: '1px solid #E0CEDE', borderRadius: 12,
  padding: '36px 32px', width: '100%', maxWidth: 380, textAlign: 'center',
  boxShadow: '0 2px 16px rgba(66,44,72,.10)',
};
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left',
  fontSize: 13, color: '#374151', fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  background: '#ffffff', border: '1px solid #d6cebc', borderRadius: 7,
  color: '#1e2a3a', padding: '9px 12px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
};
const errorStyle: React.CSSProperties = {
  background: '#fee2e2', border: '1px solid #fca5a5',
  borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#991b1b', textAlign: 'left',
};
const submitBtn: React.CSSProperties = {
  background: '#793C62', color: '#ffffff',
  border: 'none', borderRadius: 7, padding: '10px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
