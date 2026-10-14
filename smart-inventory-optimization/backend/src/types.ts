export interface PurchaseOrder {
  id: number;
  product_id: number;
  quantity: number;
  status: 'Pending' | 'Received';
  created_at: string;
  received_at: string | null;
  note: string | null;
  product_name?: string;
  product_sku?: string;
}

export interface ApiError {
  message: string;
  field?: string;
  statusCode: number;
}