import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../api/client';
import type { Product } from '../types';

/** Simple grocery illustration using inline SVG — no dependency */
function GroceryIllustration() {
  return (
    <svg
      viewBox="0 0 420 120"
      style={{ width: '100%', maxWidth: 420, display: 'block', userSelect: 'none', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {/* Ground blob */}
      <ellipse cx="210" cy="108" rx="190" ry="14" fill="#F2EAF7" opacity=".7"/>
      {/* Box 1 */}
      <rect x="60" y="62" width="68" height="44" rx="5" fill="#D6B36A" opacity=".85"/>
      <rect x="60" y="62" width="68" height="14" rx="3" fill="#b8920a" opacity=".7"/>
      <text x="94" y="74" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="sans-serif">Fresh</text>
      {/* Box 2 */}
      <rect x="148" y="50" width="76" height="56" rx="5" fill="#D6B36A" opacity=".75"/>
      <rect x="148" y="50" width="76" height="14" rx="3" fill="#b8920a" opacity=".65"/>
      <text x="186" y="62" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="sans-serif">Fresh</text>
      {/* Bottle */}
      <rect x="250" y="48" width="18" height="54" rx="5" fill="#a8c88a" opacity=".8"/>
      <rect x="254" y="42" width="10" height="10" rx="3" fill="#a8c88a" opacity=".9"/>
      {/* Can */}
      <rect x="285" y="72" width="22" height="32" rx="4" fill="#c8a070" opacity=".8"/>
      <ellipse cx="296" cy="72" rx="11" ry="4" fill="#d4b080" opacity=".9"/>
      {/* Leaves */}
      <path d="M340 90 Q350 60 370 70 Q355 80 340 90Z" fill="#9ab870" opacity=".6"/>
      <path d="M355 95 Q360 70 380 80 Q368 88 355 95Z" fill="#9ab870" opacity=".5"/>
      <path d="M30 90 Q20 65 45 72 Q38 82 30 90Z" fill="#9ab870" opacity=".55"/>
    </svg>
  );
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(err => setError(err.message ?? 'Failed to load products.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Loading" />
        <div className="state-text">Loading products…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-container">
        <div className="state-icon">⚠</div>
        <div className="state-text" role="alert">{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#9a80a0', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>Workspace</span>
        <span style={{ opacity: 0.5 }}>/</span>
        <span style={{ color: '#302336', fontWeight: 600 }}>Home</span>
      </div>

      {/* Hero heading + button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 34, fontWeight: 700,
            color: '#302336', lineHeight: 1.15, marginBottom: 8,
          }}>
            Your inventory
          </h1>
          <p style={{ fontSize: 14, color: '#7a6080', margin: 0 }}>
            A clear view of what is in stock today.
          </p>
        </div>
        <Link
          to="/products/new"
          className="btn btn-primary"
          style={{ padding: '11px 22px', fontSize: 14, borderRadius: 10, alignSelf: 'flex-start' }}
        >
          + Add Product
        </Link>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ position: 'relative', maxWidth: 380 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.45 }}
            width="15" height="15" viewBox="0 0 20 20" fill="#302336" aria-hidden="true">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
          </svg>
          <input
            type="search"
            className="search-input"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search products by name"
            style={{ paddingLeft: 36, width: '100%' }}
          />
        </div>
      </div>

      {/* Table */}
      {products.length === 0 ? (
        <div className="state-container">
          <div className="state-icon">📦</div>
          <div className="state-text">No products yet.</div>
          <Link to="/products/new" className="btn btn-primary">Add First Product</Link>
        </div>
      ) : (
        <div style={{
          background: '#FFF0E5',
          border: '1px solid #e8d4d8',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(66,44,72,.08)',
          flex: 1,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'transparent', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#FFF0E5' }}>
                <th scope="col" style={{
                  padding: '14px 22px', textAlign: 'left',
                  fontSize: 13, fontWeight: 700, color: '#302336',
                  borderBottom: '1px solid #e8d4d8',
                  textTransform: 'none', letterSpacing: 0,
                }}>
                  Product Name
                </th>
                <th scope="col" style={{
                  padding: '14px 22px', textAlign: 'left',
                  fontSize: 13, fontWeight: 700, color: '#302336',
                  borderBottom: '1px solid #e8d4d8',
                  textTransform: 'none', letterSpacing: 0,
                }}>
                  Available Stock
                </th>
              </tr>
            </thead>
            <tbody style={{ background: '#ffffff' }}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: '24px 22px', color: '#9a80a0', fontStyle: 'italic', textAlign: 'center' }}>
                    No products match "{search}"
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f0e4e8' }}>
                    <td style={{ padding: '14px 22px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Link
                          to={`/products/${p.id}`}
                          style={{ color: '#793C62', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}
                        >
                          {p.name}
                        </Link>
                        {p.is_sample === 1 && (
                          <span className="sample-tag">Sample</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 22px', fontWeight: 700, fontSize: 15, color: '#302336', verticalAlign: 'middle' }}>
                      {p.current_stock}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Decorative illustration — bottom right, non-interactive */}
      <div style={{
        pointerEvents: 'none', userSelect: 'none',
        display: 'flex', justifyContent: 'flex-end',
        marginTop: 'auto', paddingTop: 24, opacity: 0.85,
      }}>
        <GroceryIllustration />
      </div>
    </div>
  );
}
