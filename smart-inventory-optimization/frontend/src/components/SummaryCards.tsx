import type { DashboardProduct } from '../types';

interface SummaryCardsProps {
  data: DashboardProduct[];
}

/**
 * Renders 3 summary stat cards:
 *   - Total Products
 *   - Low Stock (status != 'Healthy')
 *   - Needs Reorder (status == 'Reorder now')
 */
export default function SummaryCards({ data }: SummaryCardsProps) {
  const total = data.length;
  const lowStock = data.filter((p) => p.status !== 'Healthy').length;
  const needsReorder = data.filter((p) => p.status === 'Reorder now').length;

  return (
    <div className="summary-cards">
      <div className="summary-card card">
        <div className="summary-card-value">{total}</div>
        <div className="summary-card-label">Total Products</div>
      </div>
      <div className="summary-card card">
        <div
          className="summary-card-value"
          style={{ color: lowStock > 0 ? 'var(--color-warning)' : undefined }}
        >
          {lowStock}
        </div>
        <div className="summary-card-label">Low Stock</div>
      </div>
      <div className="summary-card card">
        <div
          className="summary-card-value"
          style={{ color: needsReorder > 0 ? 'var(--color-danger)' : undefined }}
        >
          {needsReorder}
        </div>
        <div className="summary-card-label">Needs Reorder</div>
      </div>
    </div>
  );
}
