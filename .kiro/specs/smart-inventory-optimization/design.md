# Design — Smart Inventory Optimization

## 1. Architecture

The application uses a classic client–server architecture with a thin API layer and a local SQLite database. No cloud services are required during development or for the challenge demo.

```
┌─────────────────────────────────────┐
│  Browser                            │
│  React 18 + TypeScript + Vite       │
│  (Single-page application)          │
└──────────────┬──────────────────────┘
               │ HTTP (JSON REST)
               │ localhost:3001
┌──────────────▼──────────────────────┐
│  Node.js 20 + Express 4             │
│  (REST API server)                  │
│  Business logic / formula layer     │
└──────────────┬──────────────────────┘
               │ better-sqlite3
┌──────────────▼──────────────────────┐
│  SQLite 3 database                  │
│  inventory.db (single file)         │
└─────────────────────────────────────┘
```

### Communication Protocol
- All API calls use JSON over HTTP.
- The frontend runs on port 5173 (Vite dev server) and proxies `/api` to the backend on port 3001.
- API base path: `/api/v1`

---

## 2. Data Model

### Table: `products`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| `name` | TEXT | NOT NULL | Product display name |
| `sku` | TEXT | NOT NULL, UNIQUE | Stock-keeping unit code |
| `current_stock` | INTEGER | NOT NULL, ≥ 0 | Units currently in stock |
| `supplier_lead_time_days` | INTEGER | NOT NULL, ≥ 1 | Days from order to delivery |
| `safety_stock` | INTEGER | NOT NULL, ≥ 0 | Minimum buffer stock (user-set assumption) |
| `target_coverage_days` | INTEGER | NOT NULL, ≥ 1 | Desired days of forward cover (user-set assumption) |
| `is_sample` | INTEGER | NOT NULL, DEFAULT 0 | 1 = demo/seed record |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### Table: `sales_records`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| `product_id` | INTEGER | NOT NULL, FK → products.id ON DELETE CASCADE | Which product |
| `sale_date` | TEXT | NOT NULL | ISO 8601 date `YYYY-MM-DD` |
| `units_sold` | INTEGER | NOT NULL, ≥ 0 | Units sold on that date |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Unique constraint**: `(product_id, sale_date)` — one record per product per day; inserts use `INSERT OR REPLACE`.

**Stock movement rule**: Recording a sale decrements `products.current_stock` by `units_sold` in the same SQLite transaction. If the decrement would produce a negative value, the transaction is rolled back and a 400 error is returned. Upserting a sale record adjusts stock by the delta (new quantity − old quantity), so replacing 3 with 5 decrements by 2, and replacing 5 with 3 increments by 2.

### Table: `stock_movements`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| `product_id` | INTEGER | NOT NULL, FK → products.id ON DELETE CASCADE | Which product |
| `movement_date` | TEXT | NOT NULL | ISO 8601 date `YYYY-MM-DD` |
| `quantity` | INTEGER | NOT NULL | Units added (+) or removed (−) |
| `type` | TEXT | NOT NULL | `"sale"` or `"restock"` |
| `note` | TEXT | | Optional free-text label |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

`quantity` is always stored as the signed net change applied to `current_stock`: negative for sales, positive for restocks. This makes the movement log auditable without re-reading the sales table.

---

## 3. API Endpoints

### Products

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/products` | List all products |
| POST | `/api/v1/products` | Create a product |
| GET | `/api/v1/products/:id` | Get a single product |
| PUT | `/api/v1/products/:id` | Update a product |
| DELETE | `/api/v1/products/:id` | Delete a product and its sales |

### Sales Records

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/products/:id/sales` | Sales history for a product |
| POST | `/api/v1/products/:id/sales` | Add / update a daily sales entry (decrements stock) |

### Restocks

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/products/:id/restock` | Record a restock (increments stock) |
| GET | `/api/v1/products/:id/movements` | Full stock movement log for a product |

### Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/dashboard` | All products with calculated metrics |

### Demo Data

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/seed` | Load the demo dataset |
| DELETE | `/api/v1/seed` | Remove all sample data |

---

## 4. Formula Definitions (Authoritative)

The formulas below are the single source of truth. They must match the implementations in `backend/src/services/inventory.ts` and `frontend/src/utils/inventory.ts` exactly.

### 4.1 Average Daily Demand — 7-day (ADD_7)

```
ADD_7 = sum(units_sold for all sales_records where sale_date >= today − 6 days) / 7
```

- Window: today minus 6 days through today inclusive (7 calendar days).
- Division is always by 7, even if fewer than 7 records exist.
- If no records exist in the window, ADD_7 = 0.
- **Edge case**: If today has no sales record but yesterday does, the window still starts from 7 days ago relative to today's date.

### 4.2 Average Daily Demand — 3-day (ADD_3)

```
ADD_3 = sum(units_sold for all sales_records where sale_date >= today − 2 days) / 3
```

- Window: today minus 2 days through today inclusive (3 calendar days).
- Division is always by 3.
- If no records in window, ADD_3 = 0.

### 4.3 Reorder Point (ROP)

```
ROP = ceil(ADD_7 × supplier_lead_time_days + safety_stock)
```

- `safety_stock` is the user-configured minimum buffer (labelled "User-set assumption" in the UI).
- `ceil` rounds up to the nearest integer.
- Special case: if ADD_7 = 0, the formula still applies — ROP = ceil(0 × lead_time + safety_stock) = safety_stock.

### 4.4 Stock Coverage (days)

```
stock_coverage_days = current_stock / ADD_7    [if ADD_7 > 0]
stock_coverage_days = "No recent sales"        [if ADD_7 = 0]
```

- Rounded to 1 decimal place for display.
- Never divide by zero.

### 4.5 Suggested Target Stock

```
target_stock = ADD_7 × (supplier_lead_time_days + target_coverage_days) + safety_stock
```

- `target_coverage_days` is user-configured (labelled "User-set assumption").
- Not rounded; used as an intermediate value.

### 4.6 Suggested Order Quantity

```
suggested_order_qty = max(0, ceil(target_stock) − current_stock)
```

- Result is always ≥ 0.
- If current_stock ≥ ceil(target_stock), result is 0 and displayed as "Stock sufficient (0 units)".

### 4.7 Status Classification

```
if current_stock <= ROP:
    status = "Reorder now"
else if current_stock <= ROP × 1.25:
    status = "Watch"
else:
    status = "Healthy"
```

The "Watch" threshold (ROP × 1.25) means stock is between the reorder point and 25 % above it. This is a fixed rule documented here; it is not user-configurable in the MVP.

**Edge case**: When ROP = 0 (both ADD_7 = 0 and safety_stock = 0), the rule `current_stock <= 0 × 1.25 = 0` means any stock above 0 is "Healthy" and 0 stock is "Reorder now". This is the correct behaviour.

### 4.8 Trending Sales Warning

```
show_trend_warning = (ADD_3 > ADD_7 × 1.20)
```

When true, display: "Sales increasing — Recent 3-day avg ([ADD_3] units/day) is higher than 7-day avg ([ADD_7] units/day)."

---

## 5. Screen Flow

```
Home / Dashboard
 ├── [No products] → "Load demo data" button  →  Seed API call → Dashboard
 ├── [Has products] → Dashboard table (sorted: Reorder now → Watch → Healthy)
 │    ├── Click product name  →  Product Detail
 │    │    ├── Sales history table (last 30 days)
 │    │    ├── "Add sales entry" form
 │    │    ├── "Edit product" link  →  Edit Product form
 │    │    └── "Delete product" button  →  Confirm dialog  →  Dashboard
 │    └── Click metric "?"  →  Formula trace panel (inline)
 ├── "Add product" button  →  Add Product form  →  Dashboard
 └── Summary banner: "X products need reordering"
```

---

## 6. Component Tree (Frontend)

```
App
├── Layout
│   ├── NavBar
│   └── <Outlet>
├── DashboardPage
│   ├── SummaryBanner
│   ├── ProductTable
│   │   └── ProductRow (per product)
│   │       ├── StatusBadge
│   │       ├── MetricCell (wraps any calculated value)
│   │       │   └── FormulaTooltip (shown on "?" click)
│   │       └── OrderQtyCell → FormulaDrawer (full derivation)
│   └── LoadDemoButton (visible when no products)
├── ProductDetailPage
│   ├── ProductMetricsSummary
│   ├── SalesHistoryTable
│   └── AddSalesEntryForm
├── AddProductPage → ProductForm
├── EditProductPage → ProductForm
└── NotFoundPage
```

---

## 7. Validation Rules (Both Layers)

| Field | Rule |
|---|---|
| `name` | Required; string; 1–120 chars |
| `sku` | Required; string; 1–50 chars; unique across all products |
| `current_stock` | Required; integer; ≥ 0 |
| `supplier_lead_time_days` | Required; integer; ≥ 1 |
| `safety_stock` | Required; integer; ≥ 0 |
| `target_coverage_days` | Required; integer; ≥ 1 |
| `sale_date` | Required; valid ISO 8601 date string |
| `units_sold` | Required; integer; ≥ 0 |
| `restock_quantity` | Required for restock; integer; ≥ 1 |

All validation is performed on the backend. The frontend duplicates it for fast user feedback but never relies on it for correctness.

---

## 8. Demo / Seed Dataset Plan

Three products with 14 days of pre-loaded sales data. All records have `is_sample = 1`.

### Product A: "Premium Coffee Blend 1kg"
- SKU: `COFFEE-001`
- Current stock: 18 units
- Supplier lead time: 5 days
- Safety stock: 5 units
- Target coverage: 14 days
- Sales pattern: Days 1–7: 3 units/day. Days 8–14: accelerating to 6 units/day.
- **Expected outcome at load time**: ADD_7 ≈ 5.1 units/day, ADD_3 = 6.0, coverage ≈ 3.5 days (< lead time → "Reorder now"), trend warning shown.

### Product B: "Standard Flour 5kg"
- SKU: `FLOUR-005`
- Current stock: 120 units
- Supplier lead time: 3 days
- Safety stock: 10 units
- Target coverage: 14 days
- Sales pattern: Steady 8 units/day for all 14 days.
- **Expected outcome**: ADD_7 = 8, ADD_3 = 8, coverage = 15 days, ROP = 34, status "Healthy".

### Product C: "Organic Olive Oil 500ml"
- SKU: `OIL-500`
- Current stock: 40 units
- Supplier lead time: 7 days
- Safety stock: 8 units
- Target coverage: 14 days
- Sales pattern: Days 1–14: 2 units/day.
- **Expected outcome**: ADD_7 = 2, ROP = ceil(2×7+8) = 22, coverage = 20 days, status "Healthy".

The seed script (`backend/src/seed/demo-data.ts`) computes sale dates relative to the date the seed is loaded, not hardcoded calendar dates, so the demo works on any day.

---

## 9. Error Handling Strategy

| Scenario | Backend response | Frontend behaviour |
|---|---|---|
| Validation failure | 400 `{ error: "...", field: "..." }` | Show field-level error next to input |
| Stock would go negative | 400 `{ error: "Cannot record sale: would reduce stock below zero (current: N, requested: M)" }` | Show error on quantity field |
| Duplicate SKU | 409 `{ error: "SKU already exists" }` | Show error on SKU field |
| Product not found | 404 `{ error: "Product not found" }` | Redirect to dashboard with toast |
| Unexpected server error | 500 `{ error: "Internal server error" }` | Show generic error banner |
| Network error | — | Show "Could not reach server. Is the backend running?" |

---

## 10. Assumptions and Trade-offs

1. **Date window is relative to today's calendar date at load time.** There is no "as of date" selector in the MVP. This keeps the implementation simple and the formula transparent.
2. **Upsert on sales entry.** If a manager enters sales for the same product and date twice, the second entry wins. This prevents duplicate rows and is simpler than showing a conflict error.
3. **current_stock is kept in sync automatically.** Recording a sale decrements stock; recording a restock increments stock. Both operations happen inside a single SQLite transaction so the stock count is always consistent with the movement log. Stock can never go below zero — the API rejects any sale that would cause this.
4. **No user authentication.** The MVP is a single-user local tool. Multi-user and auth are post-MVP.
5. **Watch band = ROP × 1.25.** This is a fixed rule, not user-configurable, to keep the MVP scope tight. It is clearly documented and labelled in the UI.
