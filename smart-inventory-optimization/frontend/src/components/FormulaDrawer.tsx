import { useEffect } from 'react';
import type { DashboardProduct } from '../types';

interface FormulaDrawerProps {
  product: DashboardProduct;
  onClose: () => void;
}

/**
 * Right-side slide-in drawer showing the full Suggested Order Quantity derivation.
 * Step 1: ADD_7
 * Step 2: Target stock = ADD_7 × (lead time + target coverage) + safety stock
 * Step 3: Suggested order = max(0, ceil(target) - current stock)
 *
 * Labels safety_stock and target_coverage_days as "User-set assumption".
 * No AI/ML language.
 */
export default function FormulaDrawer({ product, onClose }: FormulaDrawerProps) {
  const {
    name,
    add7,
    supplier_lead_time_days,
    target_coverage_days,
    safety_stock,
    current_stock,
    targetStock,
    suggestedOrderQty,
  } = product;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const add7Rounded = add7.toFixed(2);
  const targetRounded = targetStock.toFixed(2);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className="drawer"
        role="complementary"
        aria-label={`Order quantity derivation for ${name}`}
      >
        <div className="drawer-header">
          <h2 className="drawer-title">Order Quantity Derivation</h2>
          <button
            className="drawer-close"
            onClick={onClose}
            aria-label="Close derivation panel"
          >
            ×
          </button>
        </div>
        <div className="drawer-body">
          <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            Product: <strong>{name}</strong>
          </p>

          {/* Step 1 — ADD_7 */}
          <div className="drawer-step">
            <div className="drawer-step-number">Step 1</div>
            <div className="drawer-step-label">7-Day Average Daily Demand (ADD_7)</div>
            <div className="drawer-step-formula">
              ADD_7 = total sold in last 7 days ÷ 7
              <br />
              ADD_7 = {(add7 * 7).toFixed(0)} units ÷ 7
              <br />
              <strong>ADD_7 = {add7Rounded} units/day</strong>
            </div>
          </div>

          {/* Step 2 — Target stock */}
          <div className="drawer-step">
            <div className="drawer-step-number">Step 2</div>
            <div className="drawer-step-label">Suggested Target Stock</div>
            <div className="drawer-step-formula">
              Target stock = ADD_7 × (lead time + target coverage) + safety stock
              <br />
              &nbsp;&nbsp;Lead time: {supplier_lead_time_days} days
              <br />
              &nbsp;&nbsp;Target coverage: {target_coverage_days} days
              <span className="assumption-label">User-set assumption</span>
              <br />
              &nbsp;&nbsp;Safety stock: {safety_stock} units
              <span className="assumption-label">User-set assumption</span>
              <br />
              = {add7Rounded} × ({supplier_lead_time_days} + {target_coverage_days}) +{' '}
              {safety_stock}
              <br />
              <strong>= {targetRounded} units</strong>
            </div>
          </div>

          {/* Step 3 — Suggested order */}
          <div className="drawer-step">
            <div className="drawer-step-number">Step 3</div>
            <div className="drawer-step-label">Suggested Order Quantity</div>
            <div className="drawer-step-formula">
              Suggested order = max(0, ceil(target stock) − current stock)
              <br />
              = max(0, ceil({targetRounded}) − {current_stock})
              <br />
              = max(0, {Math.ceil(targetStock)} − {current_stock})
              <br />
              <strong>= {suggestedOrderQty} units</strong>
              {suggestedOrderQty === 0 && (
                <span style={{ color: 'var(--color-success)', marginLeft: 6 }}>
                  (Stock sufficient)
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
