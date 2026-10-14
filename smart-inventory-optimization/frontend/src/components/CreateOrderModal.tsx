import { useEffect, useRef, useState } from 'react';
import type { PurchaseOrder } from '../types';

interface CreateOrderModalProps {
  productId: number;
  productName: string;
  suggestedQty: number;
  /** Pending orders already open for this product — shown as a warning */
  pendingOrders: PurchaseOrder[];
  onConfirm: (productId: number, quantity: number, note: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Modal for creating a purchase order.
 * Pre-fills product and suggested quantity; both are editable.
 * Shows a warning if there are already pending orders for this product.
 */
export default function CreateOrderModal({
  productId,
  productName,
  suggestedQty,
  pendingOrders,
  onConfirm,
  onCancel,
}: CreateOrderModalProps) {
  const [qty, setQty]     = useState(String(suggestedQty > 0 ? suggestedQty : 1));
  const [note, setNote]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstInputRef.current?.focus(); }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
        else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onCancel]);

  async function handleSubmit() {
    const parsed = parseInt(qty, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('Quantity must be a positive whole number.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(productId, parsed, note.trim());
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Failed to create order.');
      setSubmitting(false);
    }
    // on success the parent unmounts this modal, so we don't reset submitting
  }

  const pendingTotal = pendingOrders.reduce((s, o) => s + o.quantity, 0);

  return (
    <div className="modal-overlay" onClick={onCancel} aria-hidden={false}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={true}
        aria-labelledby="create-order-title"
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <h2 id="create-order-title" className="modal-title">Create Purchase Order</h2>

        {/* Product (read-only) */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Product</label>
          <div style={readonlyStyle}>{productName}</div>
        </div>

        {/* Pending warning */}
        {pendingOrders.length > 0 && (
          <div role="alert" style={warnStyle}>
            ⚠ {pendingOrders.length} pending order{pendingOrders.length > 1 ? 's' : ''} already
            open for this product ({pendingTotal} units total). Review before ordering more.
          </div>
        )}

        {/* Quantity */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="order-qty" style={labelStyle}>
            Quantity{suggestedQty > 0 && (
              <span style={{ fontWeight: 400, color: 'var(--color-muted)', marginLeft: 6 }}>
                (suggested: {suggestedQty})
              </span>
            )}
          </label>
          <input
            ref={firstInputRef}
            id="order-qty"
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={inputStyle}
            aria-describedby={error ? 'order-qty-error' : undefined}
          />
          {error && (
            <div id="order-qty-error" role="alert" style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>
              {error}
            </div>
          )}
        </div>

        {/* Note */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="order-note" style={labelStyle}>Note <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <input
            id="order-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. urgent, supplier reference…"
            style={inputStyle}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Creating…' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Local styles (reuse existing CSS variables) ───────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: 'var(--color-text-strong)', marginBottom: 6,
};
const readonlyStyle: React.CSSProperties = {
  fontSize: 14, color: '#1e2a3a', padding: '8px 10px',
  background: '#f0ece3', borderRadius: 6,
  border: '1px solid #d6cebc',
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 14,
  background: '#ffffff', color: '#1e2a3a',
  border: '1px solid #d6cebc', borderRadius: 6, outline: 'none',
};
const warnStyle: React.CSSProperties = {
  background: '#fef3c7',
  border: '1px solid #fde68a',
  borderRadius: 6, padding: '8px 12px', fontSize: 13,
  color: '#92400e', marginBottom: 14,
};
