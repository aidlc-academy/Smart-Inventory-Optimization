import { useState } from 'react';
import { Link } from 'react-router-dom';
import { seedDemo } from '../api/client';
import FormulaDrawer from '../components/FormulaDrawer';
import FormulaTrace from '../components/FormulaTrace';
import StatusBadge from '../components/StatusBadge';
import SummaryCards from '../components/SummaryCards';
import { ToastContainer, useToast } from '../components/Toast';
import { useDashboard } from '../hooks/useDashboard';
import type { DashboardProduct } from '../types';

export default function DashboardPage() {
  const { data, loading, error, refetch } = useDashboard();
  const [search, setSearch] = useState('');
  const [drawerProduct, setDrawerProduct] = useState<DashboardProduct | null>(null);
  const [seeding, setSeeding] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  async function handleLoadDemo() {
    setSeeding(true);
    try {
      await seedDemo();
      refetch();
      showToast('Demo data loaded successfully.', 'success');
    } catch {
      showToast('Failed to load demo data. Is the backend running?', 'error');
    } finally {
      setSeeding(false);
    }
  }

  const filtered = data.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Loading" />
        <div className="state-text">Loading dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-container">
        <div className="state-icon">⚠</div>
        <div className="state-text" role="alert">
          {error}
        </div>
        <button className="btn btn-secondary" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="page-header">
        <h1 className="page-title">Inventory Dashboard</h1>
        <div className="flex gap-8">
          {data.length > 0 && (
            <input
              type="search"
              className="search-input"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products by name"
            />
          )}
          <Link to="/products/new" className="btn btn-primary">
            ➕ Add Product
          </Link>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="state-container">
          <div className="state-icon">📦</div>
          <div className="state-text">No products yet.</div>
          <div className="flex gap-12">
            <Link to="/products/new" className="btn btn-primary">
              Add First Product
            </Link>
            <button
              className="btn btn-secondary"
              onClick={handleLoadDemo}
              disabled={seeding}
            >
              {seeding ? 'Loading…' : '🎲 Load demo data'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <SummaryCards data={data} />

          {filtered.length === 0 ? (
            <div className="state-container">
              <div className="state-text">No products match "{search}".</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Current Stock</th>
                    <th scope="col">ADD_7</th>
                    <th scope="col">ADD_3</th>
                    <th scope="col">Coverage</th>
                    <th scope="col">ROP</th>
                    <th scope="col">Suggested Order</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      onOpenDrawer={setDrawerProduct}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {drawerProduct && (
        <FormulaDrawer
          product={drawerProduct}
          onClose={() => setDrawerProduct(null)}
        />
      )}
    </>
  );
}

interface ProductRowProps {
  product: DashboardProduct;
  onOpenDrawer: (p: DashboardProduct) => void;
}

function ProductRow({ product, onOpenDrawer }: ProductRowProps) {
  const {
    id,
    name,
    is_sample,
    current_stock,
    add7,
    add3,
    stockCoverageDays,
    rop,
    suggestedOrderQty,
    status,
    trendWarning,
    supplier_lead_time_days,
    safety_stock,
  } = product;

  const add7Display = add7.toFixed(2);
  const add3Display = add3.toFixed(2);
  const coverageDisplay =
    stockCoverageDays === null ? 'No recent sales' : `${stockCoverageDays.toFixed(1)} days`;

  return (
    <>
      <tr>
        <td>
          <Link to={`/products/${id}`} className="link">
            {name}
          </Link>
          {is_sample === 1 && <span className="sample-tag">(Sample)</span>}
        </td>
        <td>{current_stock}</td>
        <td>
          <span>{add7Display}</span>
          <FormulaTrace
            title="ADD_7"
            steps={[
              {
                label: 'ADD_7 = total sold in last 7 days ÷ 7',
                value: `${(add7 * 7).toFixed(0)} units ÷ 7 = ${add7Display} units/day`,
              },
            ]}
          />
        </td>
        <td>
          <span>{add3Display}</span>
          <FormulaTrace
            title="ADD_3"
            steps={[
              {
                label: 'ADD_3 = total sold in last 3 days ÷ 3',
                value: `${(add3 * 3).toFixed(0)} units ÷ 3 = ${add3Display} units/day`,
              },
            ]}
          />
        </td>
        <td>{coverageDisplay}</td>
        <td>
          <span>{rop}</span>
          <FormulaTrace
            title="Reorder Point (ROP)"
            steps={[
              {
                label: 'ROP = ceil(ADD_7 × lead time + safety stock)',
                value: `ceil(${add7Display} × ${supplier_lead_time_days} + ${safety_stock}) = ${rop}`,
              },
              {
                label: 'Safety stock',
                value: `${safety_stock} units (User-set assumption)`,
              },
              {
                label: 'Lead time',
                value: `${supplier_lead_time_days} days`,
              },
            ]}
          />
        </td>
        <td>
          <span>{suggestedOrderQty === 0 ? '0 (sufficient)' : `${suggestedOrderQty} units`}</span>
          {' '}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '2px 6px' }}
            onClick={() => onOpenDrawer(product)}
            aria-label={`Show order quantity derivation for ${name}`}
          >
            Details
          </button>
        </td>
        <td>
          <StatusBadge status={status} />
        </td>
      </tr>
      {trendWarning && (
        <tr aria-label={`Sales trend warning for ${name}`}>
          <td colSpan={8} style={{ paddingTop: 0, paddingBottom: 8 }}>
            <div className="trend-warning">
              ⚠ Sales increasing — Recent 3-day avg ({add3Display} units/day) is higher than
              7-day avg ({add7Display} units/day)
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
