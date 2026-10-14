import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Inventory-box SVG logo — no external dependency */
function BoxLogo() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true">
      <rect x="4" y="14" width="30" height="20" rx="3" fill="#D6B36A" opacity=".9"/>
      <rect x="4" y="14" width="30" height="5" rx="2" fill="#b8920a"/>
      <path d="M14 14 L14 10 Q19 6 24 10 L24 14" stroke="#D6B36A" strokeWidth="1.8" fill="none"/>
      <line x1="19" y1="14" x2="19" y2="34" stroke="#b8920a" strokeWidth="1.2" opacity=".6"/>
    </svg>
  );
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { shop, user, logout } = useAuth();
  const closeSidebar = () => setSidebarOpen(false);

  const ownerName = shop?.owner_name ?? user?.email ?? '';

  return (
    <div className="main-layout">
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar-nav"
      >
        ☰
      </button>

      <nav id="sidebar-nav" className={`sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Main navigation">

        {/* Brand */}
        <div className="sidebar-header">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 6 }}>
            <BoxLogo />
            <div style={{ textAlign: 'center' }}>
              <div className="sidebar-title">Smart Inventory</div>
              <div style={{ fontSize: 9, color: 'rgba(214,179,106,.55)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 1 }}>
                Smart Inventory
              </div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div className="sidebar-nav">
          {[
            { to: '/', end: true,  icon: (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z"/></svg>
            ), label: 'Home' },
            { to: '/stock-planning', icon: (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            ), label: 'Stock Planning' },
            { to: '/daily-sales', icon: (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zm12 15a2 2 0 11-4 0 2 2 0 014 0zM5 17a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            ), label: 'Daily Sales' },
            { to: '/orders', icon: (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>
            ), label: 'Orders' },
            { to: '/products/new', icon: (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
            ), label: 'Add Product' },
            { to: '/profile', icon: (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
            ), label: 'Profile' },
          ].map(({ to, end, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              {icon}{label}
            </NavLink>
          ))}
        </div>

        {/* Footer: avatar + name + logout */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,.10)', padding: '14px 14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#D6B36A', color: '#422C48',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, flexShrink: 0,
            }}>
              {ownerName ? initials(ownerName) : '?'}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0e0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shop?.owner_name || 'Account'}
              </div>
              <div style={{ fontSize: 11, color: '#c8a8d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shop?.shop_name || 'Shop owner'}
              </div>
            </div>
          </div>
          <button
            onClick={() => { logout(); closeSidebar(); }}
            style={{
              width: '100%', background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.14)', borderRadius: 7,
              color: '#c8a8d8', fontSize: 12, padding: '6px 10px', cursor: 'pointer',
              fontWeight: 600, letterSpacing: '0.02em',
            }}
            aria-label="Log out"
          >
            Log out
          </button>
        </div>
      </nav>

      <main className="main-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
