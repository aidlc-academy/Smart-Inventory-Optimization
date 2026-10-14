import type { DashboardProduct } from '../types';

interface SummaryCardsProps {
  data: DashboardProduct[];
}

/**
 * Three summary stat cards: Total Products, Low Stock, Needs Reorder.
 * Uses dark theme card variants with gold / danger / success accent stripes.
 */
export default function SummaryCards({ data }: SummaryCardsProps) {
  const total        = data.length;
  const lowStock     = data.filter((p) => p.status !== 'Healthy').length;
  const needsReorder = data.filter((p) => p.status === 'Reorder now').length;
  const healthy      = data.filter((p) => p.status === 'Healthy').length;

  return (
    <div className="summary-cards">
      {/* Total */}
      <div className="summary-card">
        <span className="summary-card-icon" aria-hidden="true">📦</span>
        <div className="summary-card-value">{total}</div>
        <div className="summary-card-label">Total Products</div>
      </div>

      {/* Needs reorder */}
      <div className={`summary-card${needsReorder > 0 ? ' danger' : ''}`}>
        <span className="summary-card-icon" aria-hidden="true">🔴</span>
        <div
          className={`summary-card-value${needsReorder > 0 ? ' danger' : ''}`}
          aria-label={`${needsReorder} products need reordering`}
        >
          {needsReorder}
        </div>
        <div className="summary-card-label">Needs Reorder</div>
      </div>

      {/* Low stock (Watch + Reorder now) */}
      <div className={`summary-card${lowStock > 0 && lowStock !== needsReorder ? ' danger' : ''}`}>
        <span className="summary-card-icon" aria-hidden="true">⚠️</span>
        <div
          className={`summary-card-value${lowStock > 0 ? ' danger' : ''}`}
          aria-label={`${lowStock} products with low stock`}
        >
          {lowStock}
        </div>
        <div className="summary-card-label">Low / Watch Stock</div>
      </div>

      {/* Healthy */}
      <div className={`summary-card${healthy === total && total > 0 ? ' success' : ''}`}>
        <span className="summary-card-icon" aria-hidden="true">✅</span>
        <div
          className={`summary-card-value${healthy === total && total > 0 ? ' success' : ''}`}
          aria-label={`${healthy} products healthy`}
        >
          {healthy}
        </div>
        <div className="summary-card-label">Healthy</div>
      </div>
    </div>
  );
}
