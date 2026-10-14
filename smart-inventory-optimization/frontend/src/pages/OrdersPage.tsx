import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createOrder, getOrders, getProducts, markOrderReceived } from '../api/client';
import CreateOrderModal from '../components/CreateOrderModal';
import { ToastContainer, useToast } from '../components/Toast';
import type { ApiError, Product, PurchaseOrder } from '../types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const { toasts, showToast, dismissToast } = useToast();

  // ── Create-order modal state ──────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  // On the Orders page, we don't have a pre-selected product, so the modal
  // starts with productId=0 and productName=''. The user must supply a product ID.
  // To keep it simple and avoid a full product-selector widget, we reuse the
  // modal with a manual product-ID input below, or open it from Stock Planning.
  const [modalTarget, setModalTarget] = useState<{
    id: number; name: string; suggestedQty: number;
  }>({ id: 0, name: '', suggestedQty: 0 });

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (err) {
      setPageError((err as ApiError).message ?? 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }

  // ── Products for dropdown ─────────────────────────────────────────────────
  const [products, setProducts]         = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

  useEffect(() => {
    setProductsLoading(true);
    getProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, []);

  function handleOpenNewOrder() {
    const id = parseInt(selectedProductId, 10);
    if (!selectedProductId || !Number.isInteger(id) || id < 1) return;
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setModalTarget({ id: product.id, name: product.name, suggestedQty: 0 });
    setShowModal(true);
  }

  async function handleConfirmOrder(productId: number, quantity: number, note: string) {
    await createOrder({ product_id: productId, quantity, note: note || undefined });
    showToast(`Purchase order created (${quantity} units).`, 'success');
    setShowModal(false);
    setSelectedProductId('');
    loadOrders();
  }

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Loading" />
        <div className="state-text">Loading orders…</div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="state-container">
        <div className="state-icon">⚠</div>
        <div className="state-text" role="alert">{pageError}</div>
        <button className="btn btn-secondary" onClick={loadOrders}>Retry</button>
      </div>
    );
  }

  const pendingOrders  = orders.filter((o) => o.status === 'Pending');
  const receivedOrders = orders.filter((o) => o.status === 'Received');
  const pendingForModal = showModal
    ? orders.filter((o) => o.product_id === modalTarget.id && o.status === 'Pending')
    : [];

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {showModal && (
        <CreateOrderModal
          productId={modalTarget.id}
          productName={modalTarget.name}
          suggestedQty={modalTarget.suggestedQty}
          pendingOrders={pendingForModal}
          onConfirm={handleConfirmOrder}
          onCancel={() => setShowModal(false)}
        />
      )}

      <div className="page-header">
        <h1 className="page-title">Purchase Orders</h1>
        <Link to="/stock-planning" className="btn btn-secondary">← Stock Planning</Link>
      </div>

      {/* Instructions card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-strong)' }}>
            Purchase Order Flow
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          Create orders from <Link to="/stock-planning" className="link">Stock Planning</Link> using
          the <strong>+ Order</strong> button on each row — quantities are pre-filled.
          Or enter a product ID below to create one here directly.
          When an order is marked <strong>Received</strong>, stock increases once only.
        </p>

        {/* Quick create by product dropdown */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="order-product-select" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Select product
            </label>
            <select
              id="order-product-select"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={productsLoading}
              style={{
                padding: '6px 10px', fontSize: 13, borderRadius: 6, minWidth: 200,
                background: 'var(--color-bg)', color: 'var(--color-text)',
                border: '1px solid var(--color-border)', cursor: 'pointer',
              }}
            >
              <option value="">
                {productsLoading ? 'Loading…' : products.length === 0 ? 'No products' : '— choose product —'}
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (stock: {p.current_stock})
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: 13 }}
            onClick={handleOpenNewOrder}
            disabled={!selectedProductId || productsLoading}
          >
            + New Order
          </button>
        </div>
      </div>

      {/* Pending orders */}
      <h2 className="section-title">
        Pending Orders{' '}
        <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px' }}>
          {pendingOrders.length}
        </span>
      </h2>
      {pendingOrders.length === 0 ? (
        <div className="card text-muted" style={{ padding: '24px', textAlign: 'center' }}>
          No pending purchase orders. Use <strong>+ Order</strong> on Stock Planning to create one.
        </div>
      ) : (
        <div className="table-wrapper" style={{ marginBottom: 32 }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">SKU</th>
                <th scope="col">Quantity</th>
                <th scope="col">Created</th>
                <th scope="col">Note</th>
                <th scope="col" style={{ width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order) => (
                <OrderRow key={order.id} order={order} onUpdate={loadOrders} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Received orders */}
      <h2 className="section-title">
        Received Orders{' '}
        <span className="badge badge-success" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px' }}>
          {receivedOrders.length}
        </span>
      </h2>
      {receivedOrders.length === 0 ? (
        <div className="card text-muted" style={{ padding: '24px', textAlign: 'center' }}>
          No received purchase orders.
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">SKU</th>
                <th scope="col">Quantity</th>
                <th scope="col">Received</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {receivedOrders.map((order) => (
                <tr key={order.id}>
                  <td><Link to={`/products/${order.product_id}`} className="link">{order.product_name}</Link></td>
                  <td className="text-muted">{order.product_sku}</td>
                  <td>{order.quantity}</td>
                  <td>{order.received_at?.slice(0, 10) ?? '—'}</td>
                  <td className="text-muted">{order.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface OrderRowProps {
  order: PurchaseOrder;
  onUpdate: () => void;
}

function OrderRow({ order, onUpdate }: OrderRowProps) {
  const { toasts, showToast, dismissToast } = useToast();
  const [receiving, setReceiving] = useState(false);

  async function handleMarkReceived() {
    setReceiving(true);
    try {
      await markOrderReceived(order.id);
      showToast(`Order #${order.id} marked as received. Stock updated.`, 'success');
      onUpdate();
    } catch (err) {
      showToast((err as ApiError).message ?? 'Failed to mark order received.', 'error');
    } finally {
      setReceiving(false);
    }
  }

  return (
    <>
      <tr>
        <td><Link to={`/products/${order.product_id}`} className="link">{order.product_name}</Link></td>
        <td className="text-muted">{order.product_sku}</td>
        <td style={{ fontWeight: 700 }}>{order.quantity}</td>
        <td>{order.created_at.slice(0, 10)}</td>
        <td className="text-muted">{order.note ?? '—'}</td>
        <td>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={handleMarkReceived}
            disabled={receiving}
            aria-busy={receiving}
          >
            {receiving ? 'Receiving…' : 'Mark Received'}
          </button>
        </td>
      </tr>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
