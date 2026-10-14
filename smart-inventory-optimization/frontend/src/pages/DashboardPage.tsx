import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createOrder, getOrders, seedDemo } from '../api/client';
import CreateOrderModal from '../components/CreateOrderModal';
import FormulaDrawer from '../components/FormulaDrawer';
import FormulaTrace from '../components/FormulaTrace';
import StatusBadge from '../components/StatusBadge';
import SummaryCards from '../components/SummaryCards';
import { ToastContainer, useToast } from '../components/Toast';
import { useDashboard } from '../hooks/useDashboard';
import type { DashboardProduct, PurchaseOrder } from '../types';

export default function DashboardPage() {
  const { data, loading, error, refetch } = useDashboard();
  const [search, setSearch] = useState('');
  const [drawerProduct, setDrawerProduct] = useState<DashboardProduct | null>(null);
  const [seeding, setSeeding] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  // ── Order modal state ───────────────────────────────────────────────────────
  const [orderTarget, setOrderTarget] = useState<{
    id: number; name: string; suggestedQty: number;
  } | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PurchaseOrder[]>([]);

  async function openOrderModal(product: DashboardProduct) {
    // Fetch current pending orders for this product to show the warning
    try {
      const all = await getOrders();
      setPendingOrders(
        all.filter((o) => o.product_id === product.id && o.status === 'Pending')
      );
    } catch {
      setPendingOrders([]);
    }
    setOrderTarget({
      id: product.id,
      name: product.name,
      suggestedQty: product.suggestedOrderQty,
    });
  }

  async function handleConfirmOrder(productId: number, quantity: number, note: string) {
    await createOrder({ product_id: productId, quantity, note: note || undefined });
    const name = orderTarget?.name ?? 'product';
    setOrderTarget(null);
    setPendingOrders([]);
    showToast(`Purchase order created for ${name} (${quantity} units).`, 'success');
    // Stock does NOT change — only refetch dashboard if you want updated formulas
    refetch();
  }

  // ── Demo data ───────────────────────────────────────────────────────────────
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
  const reorderNow = data.filter((p) => p.status === 'Reorder now');

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
        <div className="state-text" role="alert">{error}</div>
        <button className="btn btn-secondary" onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {orderTarget && (
        <CreateOrderModal
          productId={orderTarget.id}
          productName={orderTarget.name}
          suggestedQty={orderTarget.suggestedQty}
          pendingOrders={pendingOrders}
          onConfirm={handleConfirmOrder}
          onCancel={() => { setOrderTarget(null); setPendingOrders([]); }}
        />
      )}

      <div className="page-header">
        <h1 className="page-title">Stock Planning</h1>
        <div className="flex gap-8 flex-wrap items-center">
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
          <button
            className="btn btn-secondary"
            onClick={handleLoadDemo}
            disabled={seeding}
            title="Load three sample products with 14 days of sales data"
          >
            {seeding ? 'Loading…' : '🎲 Demo Data'}
          </button>
          <Link to="/products/new" className="btn btn-primary">＋ Add Product</Link>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="state-container">
          <div className="state-icon">📦</div>
          <div className="state-text">No products yet. Load demo data or add your first product.</div>
          <div className="flex gap-12">
            <Link to="/products/new" className="btn btn-primary">Add First Product</Link>
            <button className="btn btn-secondary" onClick={handleLoadDemo} disabled={seeding}>
              {seeding ? 'Loading…' : '🎲 Load Demo Data'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <SummaryCards data={data} />

          {reorderNow.length > 0 && (
            <div className="reorder-alert-banner" role="alert" aria-label="Reorder alerts">
              <span aria-hidden="true" style={{ fontSize: 20, flexShrink: 0 }}>🚨</span>
              <div>
                <strong>{reorderNow.length} product{reorderNow.length > 1 ? 's' : ''} need reordering:</strong>{' '}
                {reorderNow.map((p, i) => (
                  <span key={p.id}>
                    <Link to={`/products/${p.id}`} className="link">{p.name}</Link>
                    {' '}
                    <span style={{ fontSize: 11, opacity: 0.75 }}>
                      (stock {p.current_stock} ≤ ROP {p.rop} = ⌈{p.add7.toFixed(2)} × {p.supplier_lead_time_days} + {p.safety_stock}⌉)
                    </span>
                    {i < reorderNow.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

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
                    <th scope="col">Stock</th>
                    <th scope="col">7-day Avg</th>
                    <th scope="col">3-day Avg</th>
                    <th scope="col">Coverage</th>
                    <th scope="col">ROP</th>
                    <th scope="col">Suggested Order</th>
                    <th scope="col">Status</th>
                    <th scope="col">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      onOpenDrawer={setDrawerProduct}
                      onCreateOrder={openOrderModal}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {drawerProduct && (
        <FormulaDrawer product={drawerProduct} onClose={() => setDrawerProduct(null)} />
      )}
    </>
  );
}

interface ProductRowProps {
  product: DashboardProduct;
  onOpenDrawer: (p: DashboardProduct) => void;
  onCreateOrder: (p: DashboardProduct) => void;
}

function ProductRow({ product, onOpenDrawer, onCreateOrder }: ProductRowProps) {
  const {
    id, name, is_sample,
    current_stock, add7, add3,
    stockCoverageDays, rop,
    suggestedOrderQty, status, trendWarning,
    supplier_lead_time_days, safety_stock,
  } = product;

  const add7Display     = add7.toFixed(2);
  const add3Display     = add3.toFixed(2);
  const coverageDisplay = stockCoverageDays === null
    ? 'No recent sales'
    : `${stockCoverageDays.toFixed(1)} d`;

  return (
    <>
      <tr>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Link to={`/products/${id}`} className="link">{name}</Link>
            {is_sample === 1 && <span className="sample-tag">Sample</span>}
            {trendWarning && (
              <span
                className="badge badge-warning"
                title={`Recent 3-day avg (${add3Display}/day) > 7-day avg (${add7Display}/day)`}
                aria-label="Sales increasing"
              >
                ↑ Rising
              </span>
            )}
          </div>
        </td>
        <td style={{ fontWeight: 700 }}>{current_stock}</td>
        <td>
          <span>{add7Display}</span>
          <FormulaTrace
            title="ADD_7"
            steps={[
              { label: 'Formula', value: 'ADD_7 = total sold in last 7 days ÷ 7' },
              { label: 'Calculation', value: `${(add7 * 7).toFixed(0)} units ÷ 7 = ${add7Display} units/day` },
            ]}
          />
        </td>
        <td>
          <span>{add3Display}</span>
          <FormulaTrace
            title="ADD_3"
            steps={[
              { label: 'Formula', value: 'ADD_3 = total sold in last 3 days ÷ 3' },
              { label: 'Calculation', value: `${(add3 * 3).toFixed(0)} units ÷ 3 = ${add3Display} units/day` },
            ]}
          />
        </td>
        <td
          style={{
            color: stockCoverageDays !== null && stockCoverageDays < supplier_lead_time_days
              ? 'var(--color-danger)' : undefined,
            fontWeight: stockCoverageDays !== null && stockCoverageDays < supplier_lead_time_days
              ? 700 : undefined,
          }}
        >
          {coverageDisplay}
          {stockCoverageDays !== null && (
            <FormulaTrace
              title="Stock Coverage"
              steps={[
                { label: 'Formula', value: 'Coverage = current stock ÷ ADD_7' },
                { label: 'Calculation', value: `${current_stock} ÷ ${add7Display} = ${stockCoverageDays.toFixed(1)} days` },
              ]}
            />
          )}
        </td>
        <td>
          <span>{rop}</span>
          <FormulaTrace
            title="Reorder Point (ROP)"
            steps={[
              { label: 'Formula', value: 'ROP = ⌈ADD_7 × lead time + safety stock⌉' },
              { label: 'Calculation', value: `⌈${add7Display} × ${supplier_lead_time_days} + ${safety_stock}⌉ = ${rop}` },
              { label: 'Safety stock', value: `${safety_stock} units (User-set assumption)` },
            ]}
          />
        </td>
        <td>
          {suggestedOrderQty === 0 ? (
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Sufficient</span>
          ) : (
            <span style={{
              background: 'rgba(245,158,11,.15)', color: '#fbbf24',
              border: '1px solid rgba(245,158,11,.35)', borderRadius: 5,
              padding: '2px 8px', fontWeight: 700, fontSize: 13,
            }}>
              {suggestedOrderQty} units
            </span>
          )}
          {' '}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '2px 7px' }}
            onClick={() => onOpenDrawer(product)}
            aria-label={`Show order quantity derivation for ${name}`}
          >
            ⓘ
          </button>
        </td>
        <td>
          <StatusBadge status={status} />
        </td>
        <td>
          <button
            className="btn btn-primary"
            style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
            onClick={() => onCreateOrder(product)}
            aria-label={`Create purchase order for ${name}`}
          >
            + Order
          </button>
        </td>
      </tr>
      {trendWarning && (
        <tr aria-label={`Sales trend warning for ${name}`}>
          <td colSpan={9} style={{ paddingTop: 0, paddingBottom: 10 }}>
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
