import type {
  Product,
  SalesRecord,
  StockMovement,
  DashboardProduct,
  ApiError,
  PurchaseOrder,
} from '../types';
import { supabase } from '../lib/supabase';

const BASE_URL: string = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '/api/v1';

/**
 * Core fetch wrapper.
 * Automatically attaches the current Supabase access token as Bearer token.
 * Throws an ApiError for any non-2xx response.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Get the current session token — null if logged out
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    const err: ApiError = {
      message: 'Could not reach server. Is the backend running?',
      statusCode: 0,
    };
    throw err;
  }

  if (!response.ok) {
    let body: { error?: string; message?: string; field?: string } = {};
    try { body = await response.json(); } catch { /* ignore */ }
    const err: ApiError = {
      message: body.error ?? body.message ?? `Request failed with status ${response.status}`,
      field: body.field,
      statusCode: response.status,
    };
    throw err;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ─── Products ────────────────────────────────────────────────────────────────

export function getProducts(): Promise<Product[]> {
  return request<Product[]>('/products');
}

export function getProduct(id: number): Promise<Product> {
  return request<Product>(`/products/${id}`);
}

export function createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  return request<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
}

export function updateProduct(id: number, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product> {
  return request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteProduct(id: number): Promise<void> {
  return request<void>(`/products/${id}`, { method: 'DELETE' });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function getDashboard(): Promise<DashboardProduct[]> {
  return request<DashboardProduct[]>('/dashboard');
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export function getSales(productId: number): Promise<SalesRecord[]> {
  return request<SalesRecord[]>(`/products/${productId}/sales`);
}

/** Fetch the single sales record for a specific date (bypasses the 30-day window). */
export function getSalesForDate(productId: number, date: string): Promise<SalesRecord[]> {
  return request<SalesRecord[]>(`/products/${productId}/sales?date=${encodeURIComponent(date)}`);
}

export function recordSale(productId: number, data: { sale_date: string; units_sold: number }): Promise<{ product: Product; salesRecord: SalesRecord }> {
  return request<{ product: Product; salesRecord: SalesRecord }>(
    `/products/${productId}/sales`, { method: 'POST', body: JSON.stringify(data) }
  );
}

export function recordRestock(productId: number, data: { quantity: number; note?: string }): Promise<Product> {
  return request<Product>(`/products/${productId}/restock`, { method: 'POST', body: JSON.stringify(data) });
}

export function getMovements(productId: number): Promise<StockMovement[]> {
  return request<StockMovement[]>(`/products/${productId}/movements`);
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export function getOrders(): Promise<PurchaseOrder[]> {
  return request<PurchaseOrder[]>('/orders');
}

export function createOrder(data: { product_id: number; quantity: number; note?: string }): Promise<PurchaseOrder> {
  return request<PurchaseOrder>('/orders', { method: 'POST', body: JSON.stringify(data) });
}

export function markOrderReceived(orderId: number, data?: { note?: string }): Promise<PurchaseOrder> {
  return request<PurchaseOrder>(`/orders/${orderId}/receive`, { method: 'POST', body: JSON.stringify(data || {}) });
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

export interface OnboardResult {
  message: string;
  owner_id: number;
  shop_id: number;
  owner_name: string;
  shop_name: string;
}

/**
 * Calls POST /api/v1/onboard with an explicit access token.
 * Bypasses the automatic session lookup so it can be called immediately
 * after signup when the session may not be in the Supabase client yet.
 */
export async function onboard(
  data: { owner_name: string; shop_name: string },
  accessToken: string
): Promise<OnboardResult> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });
  } catch {
    throw { message: 'Could not reach server.', statusCode: 0 } as ApiError;
  }

  if (!response.ok) {
    let body: { error?: string; message?: string } = {};
    try { body = await response.json(); } catch { /* ignore */ }
    throw { message: body.error ?? body.message ?? `Onboarding failed (${response.status})`, statusCode: response.status } as ApiError;
  }

  return response.json() as Promise<OnboardResult>;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

export function seedDemo(): Promise<{ message: string }> {
  return request<{ message: string }>('/seed', { method: 'POST' });
}

export function deleteDemo(): Promise<{ message: string }> {
  return request<{ message: string }>('/seed', { method: 'DELETE' });
}
