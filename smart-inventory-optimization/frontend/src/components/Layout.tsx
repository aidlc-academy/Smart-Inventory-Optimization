import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="main-layout">
      {/* Hamburger toggle for mobile */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar-nav"
      >
        ☰
      </button>

      {/* Sidebar */}
      <nav
        id="sidebar-nav"
        className={`sidebar${sidebarOpen ? ' open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-header">
          <div className="sidebar-title">Smart Inventory</div>
        </div>
        <div className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={closeSidebar}
          >
            📊 Dashboard
          </NavLink>
          <NavLink
            to="/products/new"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={closeSidebar}
          >
            ➕ Add Product
          </NavLink>
        </div>
      </nav>

      {/* Page content */}
      <main className="main-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
