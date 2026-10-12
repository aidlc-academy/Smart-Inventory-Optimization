import type {
  Product,
  SalesRecord,
  StockMovement,
  DashboardProduct,
  ApiError,
} from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL: string = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '/api/v1';

/** Throws an ApiError for any non-2xx response. */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    const err: ApiError = {
      message: 'Could not reach server. Is the backend running?',
      statusCode: 0,
    };
    throw err;
  }

  if (!response.ok) {
    let body: { error?: string; field?: string } = {};
    try {
      body = (await response.json()) as { error?: string; field?: string };
    } catch {
      // ignore parse errors
    }
    const err: ApiError = {
      message: body.error ?? `Request failed with status ${response.status}`,
      field: body.field,
      statusCode: response.status,
    };
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Products ────────────────────────────────────────────────────────────────

export function getProducts(): Promise<Product[]> {
  return request<Product[]>('/products');
}

export function getProduct(id: number): Promise<Product> {
  return request<Product>(`/products/${id}`);
}

export function createProduct(
  data: Omit<Product, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  return request<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProduct(
  id: number,
  data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>
): Promise<Product> {
  return request<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
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

export function recordSale(
  productId: number,
  data: { sale_date: string; units_sold: number }
): Promise<{ product: Product; salesRecord: SalesRecord }> {
  return request<{ product: Product; salesRecord: SalesRecord }>(
    `/products/${productId}/sales`,
    { method: 'POST', body: JSON.stringify(data) }
  );
}

export function recordRestock(
  productId: number,
  data: { quantity: number; note?: string }
): Promise<Product> {
  return request<Product>(`/products/${productId}/restock`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getMovements(productId: number): Promise<StockMovement[]> {
  return request<StockMovement[]>(`/products/${productId}/movements`);
}

// ─── Seed ────────────────────────────────────────────────────────────────────

export function seedDemo(): Promise<{ message: string }> {
  return request<{ message: string }>('/seed', { method: 'POST' });
}

export function deleteDemo(): Promise<{ message: string }> {
  return request<{ message: string }>('/seed', { method: 'DELETE' });
}
