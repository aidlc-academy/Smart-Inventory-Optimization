import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteProduct,
  getMovements,
  getProduct,
  getSales,
  recordRestock,
  recordSale,
} from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import { ToastContainer, useToast } from '../components/Toast';
import {
  calcADD3,
  calcADD7,
  calcROP,
  calcStatus,
  calcStockCoverage,
  calcSuggestedOrderQty,
  calcTargetStock,
  calcTrendWarning,
} from '../utils/inventory';
import type { ApiError, Product, SalesRecord, StockMovement } from '../types';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sale form state
  const [saleDate, setSaleDate] = useState(todayISO());
  const [saleUnits, setSaleUnits] = useState('');
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleMessage, setSaleMessage] = useState<string | null>(null);

  // Restock form state
  const [restockQty, setRestockQty] = useState('');
  const [restockNote, setRestockNote] = useState('');
  const [restockError, setRestockError] = useState<string | null>(null);
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  // Date range filter for sales table
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [filterEndDate, setFilterEndDate] = useState(todayISO());

  const productId = Number(id);

  async function loadData() {
    try {
      const [p, s, m] = await Promise.all([
        getProduct(productId),
        getSales(productId),
        getMovements(productId),
      ]);
      setProduct(p);
      // Sort sales descending by date (most recent first)
      s.sort((a, b) => b.sale_date.localeCompare(a.sale_date));
      setSales(s);
      setMovements(m);
      setLoading(false);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 404) {
        navigate('/');
        return;
      }
      setPageError(apiErr.message ?? 'Failed to load product.');
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!productId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function handleRecordSale(e: React.FormEvent) {
    e.preventDefault();
    setSaleError(null);
    setSaleMessage(null);

    const units = Number(saleUnits);
    if (!saleDate) { setSaleError('Date is required.'); return; }
    if (!Number.isInteger(units) || units < 0) {
      setSaleError('Units sold must be an integer ≥ 0.');
      return;
    }

    // Check if this date already has an entry (for upsert message)
    const existing = sales.find((s) => s.sale_date === saleDate);

    setSaleSubmitting(true);
    try {
      const result = await recordSale(productId, { sale_date: saleDate, units_sold: units });
      setProduct(result.product);
      setSaleUnits('');
      if (existing) {
        setSaleMessage(`Updated existing entry for ${saleDate}.`);
      }
      showToast(
        `Sale recorded. Current stock: ${result.product.current_stock}`,
        'success'
      );
      // Reload sales and movements
      const [s, m] = await Promise.all([getSales(productId), getMovements(productId)]);
      setSales(s);
      setMovements(m);
    } catch (err) {
      const apiErr = err as ApiError;
      setSaleError(apiErr.message);
    } finally {
      setSaleSubmitting(false);
    }
  }

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault();
    setRestockError(null);

    const qty = Number(restockQty);
    if (!Number.isInteger(qty) || qty < 1) {
      setRestockError('Quantity must be an integer ≥ 1.');
      return;
    }

    setRestockSubmitting(true);
    try {
      const updatedProduct = await recordRestock(productId, {
        quantity: qty,
        note: restockNote.trim() || undefined,
      });
      setProduct(updatedProduct);
      setRestockQty('');
      setRestockNote('');
      showToast(
        `Restock recorded. Current stock: ${updatedProduct.current_stock}`,
        'success'
      );
      const [s, m] = await Promise.all([getSales(productId), getMovements(productId)]);
      setSales(s);
      setMovements(m);
    } catch (err) {
      const apiErr = err as ApiError;
      setRestockError(apiErr.message);
    } finally {
      setRestockSubmitting(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteProduct(productId);
      navigate('/');
    } catch (err) {
      const apiErr = err as ApiError;
      showToast(apiErr.message ?? 'Failed to delete product.', 'error');
    }
  }

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Loading" />
        <div className="state-text">Loading product…</div>
      </div>
    );
  }

  if (pageError || !product) {
    return (
      <div className="state-container">
        <div className="state-icon">⚠</div>
        <div className="state-text" role="alert">
          {pageError ?? 'Product not found.'}
        </div>
        <Link to="/" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Compute metrics from recent sales (last 7 / 3 days)
  const today = todayISO();
  const msPerDay = 86400000;
  const todayMs = new Date(today).getTime();
  const sales7 = sales.filter(
    (s) => new Date(s.sale_date).getTime() >= todayMs - 6 * msPerDay
  );
  const sales3 = sales.filter(
    (s) => new Date(s.sale_date).getTime() >= todayMs - 2 * msPerDay
  );
  const total7 = sales7.reduce((sum, s) => sum + s.units_sold, 0);
  const total3 = sales3.reduce((sum, s) => sum + s.units_sold, 0);
  const add7 = calcADD7(total7);
  const add3 = calcADD3(total3);
  const rop = calcROP(add7, product.supplier_lead_time_days, product.safety_stock);
  const coverage = calcStockCoverage(product.current_stock, add7);
  const targetStock = calcTargetStock(
    add7,
    product.supplier_lead_time_days,
    product.target_coverage_days,
    product.safety_stock
  );
  const suggestedOrderQty = calcSuggestedOrderQty(targetStock, product.current_stock);
  const status = calcStatus(product.current_stock, rop);
  const trendWarning = calcTrendWarning(add3, add7);

  const isFutureDate = saleDate > today;

  // Filter sales by selected date range
  const filteredSales = sales.filter((s) => {
    if (filterStartDate && s.sale_date < filterStartDate) return false;
    if (filterEndDate && s.sale_date > filterEndDate) return false;
    return true;
  });

  const totalUnitsInRange = filteredSales.reduce((sum, s) => sum + s.units_sold, 0);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Product"
          message={`Are you sure you want to delete "${product.name}"? This will also delete all sales history.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          destructive
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {product.name}
            {product.is_sample === 1 && <span className="sample-tag">(Sample)</span>}
          </h1>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            SKU: {product.sku}
          </div>
        </div>
        <div className="flex gap-8">
          <Link to={`/products/${product.id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{product.current_stock}</div>
          <div className="metric-label">Current Stock</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{add7.toFixed(2)}</div>
          <div className="metric-label">ADD_7 (units/day)</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{add3.toFixed(2)}</div>
          <div className="metric-label">ADD_3 (units/day)</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {coverage === null ? '—' : `${coverage.toFixed(1)}d`}
          </div>
          <div className="metric-label">
            {coverage === null ? 'No recent sales' : 'Stock Coverage'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{rop}</div>
          <div className="metric-label">Reorder Point</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{suggestedOrderQty}</div>
          <div className="metric-label">Suggested Order</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            <StatusBadge status={status} />
          </div>
          <div className="metric-label">Status</div>
        </div>
      </div>

      {trendWarning && (
        <div className="trend-warning" style={{ marginBottom: 16 }}>
          ⚠ Sales increasing — Recent 3-day avg ({add3.toFixed(2)} units/day) is higher than
          7-day avg ({add7.toFixed(2)} units/day)
        </div>
      )}

      {/* Product config */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Configuration</div>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
              Lead Time
            </div>
            <div style={{ fontWeight: 600 }}>{product.supplier_lead_time_days} days</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
              Safety Stock <span className="assumption-label">User-set</span>
            </div>
            <div style={{ fontWeight: 600 }}>{product.safety_stock} units</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
              Target Coverage <span className="assumption-label">User-set</span>
            </div>
            <div style={{ fontWeight: 600 }}>{product.target_coverage_days} days</div>
          </div>
        </div>
      </div>

      {/* Two-column forms */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 24 }}>

        {/* Add Sales Entry */}
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>Record Sale</h2>
          <form onSubmit={handleRecordSale} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-date">
                Sale Date
              </label>
              <input
                id="sale-date"
                type="date"
                className="form-input"
                value={saleDate}
                onChange={(e) => { setSaleDate(e.target.value); setSaleError(null); setSaleMessage(null); }}
                required
                aria-required="true"
              />
              {isFutureDate && (
                <div className="alert alert-warning" style={{ marginTop: 6, padding: '6px 10px', fontSize: 12 }}>
                  ⚠ Date is in the future.
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-units">
                Units Sold
              </label>
              <input
                id="sale-units"
                type="number"
                className={`form-input${saleError ? ' error' : ''}`}
                value={saleUnits}
                onChange={(e) => { setSaleUnits(e.target.value); setSaleError(null); }}
                min={0}
                step={1}
                required
                aria-required="true"
                aria-describedby={saleError ? 'sale-units-error' : undefined}
              />
              {saleError && (
                <div id="sale-units-error" className="form-error" role="alert">
                  {saleError}
                </div>
              )}
              {saleMessage && (
                <div className="form-hint" style={{ color: 'var(--color-primary)', marginTop: 4 }}>
                  {saleMessage}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saleSubmitting}
            >
              {saleSubmitting ? 'Saving…' : 'Record Sale'}
            </button>
          </form>
        </div>

        {/* Restock Form */}
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>Record Restock</h2>
          <form onSubmit={handleRestock} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="restock-qty">
                Quantity Received
              </label>
              <input
                id="restock-qty"
                type="number"
                className={`form-input${restockError ? ' error' : ''}`}
                value={restockQty}
                onChange={(e) => { setRestockQty(e.target.value); setRestockError(null); }}
                min={1}
                step={1}
                required
                aria-required="true"
                aria-describedby={restockError ? 'restock-qty-error' : undefined}
              />
              {restockError && (
                <div id="restock-qty-error" className="form-error" role="alert">
                  {restockError}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="restock-note">
                Note (optional)
              </label>
              <input
                id="restock-note"
                type="text"
                className="form-input"
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
                placeholder="e.g. Regular supplier delivery"
                maxLength={200}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={restockSubmitting}
            >
              {restockSubmitting ? 'Saving…' : 'Record Restock'}
            </button>
          </form>
        </div>
      </div>

      {/* Sales history summary card */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Sales Summary
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-gold-bright)', marginBottom: 4 }}>
              {totalUnitsInRange}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Units sold
              {filterStartDate !== '' && filterEndDate !== '' && (
                <span style={{ marginLeft: 6, fontStyle: 'italic' }}>
                  from {filterStartDate} to {filterEndDate}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sales history table with date-range filter */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Sales History</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
              Start Date
            </label>
            <input
              type="date"
              className="form-input"
              style={{ width: 150 }}
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              aria-label="Filter start date"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
              End Date
            </label>
            <input
              type="date"
              className="form-input"
              style={{ width: 150 }}
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              aria-label="Filter end date"
            />
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: 12 }}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 30);
              setFilterStartDate(d.toISOString().slice(0, 10));
              setFilterEndDate(todayISO());
            }}
          >
            Reset to 30 days
          </button>
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div className="card text-muted" style={{ padding: '24px', textAlign: 'center' }}>
          No sales recorded in the selected date range.
        </div>
      ) : (
        <div className="table-wrapper" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Units Sold</th>
                <th scope="col" style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => (
                <tr key={s.id}>
                  <td>{s.sale_date}</td>
                  <td>{s.units_sold}</td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => {
                        setSaleDate(s.sale_date);
                        setSaleUnits(s.units_sold.toString());
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      aria-label={`Edit sale on ${s.sale_date}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock movement log */}
      <h2 className="section-title">Stock Movement Log (Last 60 Days)</h2>
      {movements.length === 0 ? (
        <div className="card text-muted" style={{ padding: '24px', textAlign: 'center' }}>
          No stock movements in the last 60 days.
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Quantity</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.movement_date}</td>
                  <td>
                    <span
                      className={`badge ${m.type === 'restock' ? 'badge-success' : 'badge-danger'}`}
                    >
                      {m.type}
                    </span>
                  </td>
                  <td
                    style={{ color: m.quantity >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                  >
                    {m.quantity >= 0 ? '+' : ''}{m.quantity}
                  </td>
                  <td className="text-muted">{m.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
