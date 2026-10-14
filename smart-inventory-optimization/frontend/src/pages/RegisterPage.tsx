import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function RegisterPage() {
  const [ownerName, setOwnerName] = useState('');
  const [shopName,  setShopName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [sent,      setSent]      = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ownerName.trim()) { setError('Owner name is required.'); return; }
    if (!shopName.trim())  { setError('Shop name is required.'); return; }
    if (!email.trim())     { setError('Email is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      sessionStorage.setItem('pending_owner_name', ownerName.trim());
      sessionStorage.setItem('pending_shop_name',  shopName.trim());
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        sessionStorage.removeItem('pending_owner_name');
        sessionStorage.removeItem('pending_shop_name');
        setError(signUpError.message);
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div style={wrap}>
        <div style={formSide}>
          <div style={authCard}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#302336', marginBottom: 8 }}>Check your email</h1>
            <p style={{ fontSize: 13, color: '#7a6080', lineHeight: 1.6 }}>
              We sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your account, then{' '}
              <Link to="/login" style={linkStyle}>log in here</Link>.
            </p>
            <p style={{ fontSize: 12, color: '#9a80a0', marginTop: 12 }}>
              Your owner name and shop name are saved and will be set up after you confirm.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap} className="auth-wrap">
      {/* Decorative panel */}
      <div style={panel} className="auth-panel" aria-hidden="true">
        <div style={panelInner}>
          <div style={diamondIcon}>◆</div>
          <div style={panelTitle}>Get started</div>
          <div style={panelSub}>Create your shop account and start tracking inventory in minutes.</div>
          <div style={panelFeatures}>
            <div style={feat}>✅ Free to use, no setup fee</div>
            <div style={feat}>📊 Real-time demand estimates</div>
            <div style={feat}>🔐 Secure, shop-isolated data</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={formSide} className="auth-form-side">
        <div style={authCard}>
          <div style={brandRow}>
            <span style={diamondSm}>◆</span>
            <span style={authTitle}>Create account</span>
          </div>
          <p style={authSub}>Fill in your details to get started</p>

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
            <label style={labelStyle}>
              Email
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" required />
            </label>
            <label style={labelStyle}>
              Password
              <div style={{ position: 'relative' }}>
                <input style={{ ...inputStyle, paddingRight: 40 }} type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters" autoComplete="new-password" required />
                <button type="button" onClick={() => setShowPw(v => !v)} style={eyeBtn} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            {error && <div role="alert" style={errorStyle}>{error}</div>}

            <button type="submit" disabled={loading} style={submitBtn}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#7a6080' }}>
            Already have an account? <Link to="/login" style={linkStyle}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Shared styles (same palette as Login) ── */
const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'row', background: '#FFF8F0' };
const panel: React.CSSProperties = { flex: '0 0 42%', background: '#422C48', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 };
const panelInner: React.CSSProperties = { color: '#f0e0ff', maxWidth: 320 };
const diamondIcon: React.CSSProperties = { fontSize: 36, marginBottom: 16, background: 'linear-gradient(135deg,#D6B36A,#a8832a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
const panelTitle: React.CSSProperties = { fontSize: 26, fontWeight: 800, color: '#D6B36A', marginBottom: 6 };
const panelSub: React.CSSProperties   = { fontSize: 13, color: '#c8a8d8', marginBottom: 32, lineHeight: 1.5 };
const panelFeatures: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };
const feat: React.CSSProperties = { fontSize: 14, color: '#e0c8f0', display: 'flex', alignItems: 'center', gap: 8 };
const formSide: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const authCard: React.CSSProperties = { background: '#FFF0E5', border: '1px solid #E0CEDE', borderRadius: 14, padding: '36px 32px', width: '100%', maxWidth: 400, boxShadow: '0 2px 16px rgba(66,44,72,.10)' };
const brandRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 };
const diamondSm: React.CSSProperties = { width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg,#D6B36A,#a8832a)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff' };
const authTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#302336', margin: 0 };
const authSub: React.CSSProperties   = { fontSize: 13, color: '#7a6080', marginBottom: 22, marginTop: 4 };
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#4a3450', fontWeight: 600 };
const inputStyle: React.CSSProperties = { background: '#ffffff', border: '1px solid #d8c6d8', borderRadius: 7, color: '#302336', padding: '9px 12px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };
const eyeBtn: React.CSSProperties = { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 };
const errorStyle: React.CSSProperties = { background: '#fde8e8', border: '1px solid #f5b8b8', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#8b1a1a' };
const submitBtn: React.CSSProperties = { background: '#793C62', color: '#ffffff', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 4 };
const linkStyle: React.CSSProperties = { color: '#793C62', textDecoration: 'none', fontWeight: 600 };
