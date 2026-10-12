/** A product row as returned by the API. */
export interface Product {
  id: number;
  name: string;
  sku: string;
  current_stock: number;
  supplier_lead_time_days: number;
  safety_stock: number;
  target_coverage_days: number;
  is_sample: number; // 1 = demo record, 0 = real
  created_at: string;
  updated_at: string;
}

/** A single daily sales record. */
export interface SalesRecord {
  id: number;
  product_id: number;
  sale_date: string; // YYYY-MM-DD
  units_sold: number;
  created_at: string;
}

/** A stock movement entry (sale or restock). */
export interface StockMovement {
  id: number;
  product_id: number;
  movement_date: string; // YYYY-MM-DD
  quantity: number; // negative for sales, positive for restocks
  type: 'sale' | 'restock';
  note: string | null;
  created_at: string;
}

/** Dashboard product — extends Product with all calculated metrics. */
export interface DashboardProduct extends Product {
  add7: number;
  add3: number;
  rop: number;
  stockCoverageDays: number | null;
  targetStock: number;
  suggestedOrderQty: number;
  status: 'Reorder now' | 'Watch' | 'Healthy';
  trendWarning: boolean;
}

/** API error thrown by the client module. */
export interface ApiError {
  message: string;
  field?: string;
  statusCode: number;
}
