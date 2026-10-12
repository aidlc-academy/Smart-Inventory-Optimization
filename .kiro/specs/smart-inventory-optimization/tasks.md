# Implementation Tasks — Smart Inventory Optimization

Tasks are ordered so that each task builds only on tasks already completed. No application code should be written until this planning phase is approved.

---

## Phase 0 — Project Scaffold

### T-01 Initialise backend project
- Create `backend/` directory with `package.json` (Node.js + Express + better-sqlite3 + TypeScript).
- Add `tsconfig.json` with `strict: true`.
- Add `src/index.ts` that starts an Express server on port 3001 with a health-check endpoint `GET /api/v1/health → { status: "ok" }`.
- Add `src/db/database.ts` that opens (or creates) `inventory.db` using `better-sqlite3`.
- **Verification**: `GET /api/v1/health` returns `{ status: "ok" }`.

### T-02 Database migrations
- Create `src/db/migrations.ts` that runs the CREATE TABLE statements for `products`, `sales_records`, and `stock_movements` (schema defined in design.md §2).
- Migrations run automatically on server start if tables do not exist.
- **Verification**: Starting the server creates the three tables; starting it again does not error.

### T-03 Initialise frontend project
- Create `frontend/` with `npm create vite` using the React + TypeScript template.
- Add Vite proxy config so `/api` → `http://localhost:3001`.
- Add a minimal `App.tsx` that renders "Smart Inventory Optimization".
- **Verification**: `npm run dev` serves the app; the proxy works (visiting `/api/v1/health` in the browser returns the backend response).

---

## Phase 1 — Formula Library

### T-04 Backend formula service
- Create `backend/src/services/inventory.ts`.
- Implement and export the following pure functions exactly as defined in design.md §4:
  - `calcADD7(salesRecords: SalesRecord[], today: Date): number`
  - `calcADD3(salesRecords: SalesRecord[], today: Date): number`
  - `calcROP(add7: number, leadTimeDays: number, safetyStock: number): number`
  - `calcStockCoverage(currentStock: number, add7: number): number | null` (null = no recent sales)
  - `calcTargetStock(add7: number, leadTimeDays: number, targetCoverageDays: number, safetyStock: number): number`
  - `calcSuggestedOrderQty(targetStock: number, currentStock: number): number`
  - `calcStatus(currentStock: number, rop: number): "Reorder now" | "Watch" | "Healthy"`
  - `calcTrendWarning(add3: number, add7: number): boolean`
- Each function has a JSDoc comment citing the formula.
- **Verification**: Unit tests in `backend/src/services/inventory.test.ts` all pass covering: normal input, zero demand, zero safety stock, stock exactly equal to ROP, stock exactly equal to ROP × 1.25.

### T-05 Frontend formula utility
- Create `frontend/src/utils/inventory.ts` with the same functions (same signatures, TypeScript).
- This is the source of truth for formula trace display in the UI — it mirrors the backend to allow offline trace rendering.
- **Verification**: Unit tests in `frontend/src/utils/inventory.test.ts` all pass with the same test cases as T-04.

---

## Phase 2 — Product CRUD API

### T-06 Products API — list and create
- Create `backend/src/routes/products.ts`.
- Implement `GET /api/v1/products` (returns all products, sorted by name).
- Implement `POST /api/v1/products` (validates all fields per design.md §7, creates product).
- **Verification**: A POST with valid data returns 201 with the created product; a POST missing a field returns 400 with a field-level error; a POST with a duplicate SKU returns 409.

### T-07 Products API — get, update, delete
- Implement `GET /api/v1/products/:id`.
- Implement `PUT /api/v1/products/:id` (validates fields, updates product).
- Implement `DELETE /api/v1/products/:id` (deletes product; cascade removes sales records).
- **Verification**: GET returns 404 for unknown ID; DELETE removes both the product row and all its sales rows.

### T-08 Sales records and stock movement API
- Create `backend/src/routes/sales.ts`.
- Implement `GET /api/v1/products/:id/sales` (last 30 days, descending by date).
- Implement `POST /api/v1/products/:id/sales` — inside a single SQLite transaction:
  1. Upsert the sales record by `(product_id, sale_date)`.
  2. Compute the net delta: if a previous record existed for that date, delta = new qty − old qty; otherwise delta = new qty.
  3. Check that `current_stock − delta >= 0`; if not, roll back and return 400.
  4. Decrement `products.current_stock` by delta.
  5. Insert a row into `stock_movements` (type="sale", quantity=−delta).
- Implement `POST /api/v1/products/:id/restock` — inside a single transaction:
  1. Validate `quantity >= 1`.
  2. Increment `products.current_stock` by quantity.
  3. Insert a row into `stock_movements` (type="restock", quantity=+quantity, note optional).
- Implement `GET /api/v1/products/:id/movements` (all movements, descending by date, last 60 days).
- **Verification**: Recording a sale decreases `current_stock` in the database. Recording a restock increases it. Attempting a sale of more units than in stock returns 400. POSTing the same product+date twice results in one sales row and a corrected stock.

### T-09 Dashboard API
- Create `backend/src/routes/dashboard.ts`.
- Implement `GET /api/v1/dashboard`:
  - Fetches all products.
  - For each product, fetches its last 14 days of sales records.
  - Calls all formula functions from the inventory service.
  - Returns an array of objects, one per product, containing all raw product fields plus: `add7`, `add3`, `rop`, `stockCoverageDays` (number or null), `suggestedOrderQty`, `status`, `trendWarning`, `targetStock`.
- Sort order in the response: "Reorder now" first, then "Watch", then "Healthy", then alphabetically within each group.
- **Verification**: Loading the dashboard after the seed data is loaded returns Coffee as the first row with status "Reorder now" and trendWarning = true.

---

## Phase 3 — Seed / Demo Data

### T-10 Demo seed script
- Create `backend/src/seed/demo-data.ts` with the three products and sales patterns defined in design.md §8.
- Sale dates are computed relative to `new Date()` at execution time (no hardcoded calendar dates).
- All records set `is_sample = 1`.
- Implement `POST /api/v1/seed` (calls the seed script; if sample products already exist, replaces them).
- Implement `DELETE /api/v1/seed` (removes all records with `is_sample = 1`).
- **Verification**: After POST /api/v1/seed, dashboard shows at least one "Reorder now" product and at least one "Sales increasing" indicator. After DELETE /api/v1/seed, those products are gone.

---

## Phase 4 — Frontend Pages

### T-11 API client layer
- Create `frontend/src/api/client.ts` with typed `fetch` wrappers for every backend endpoint.
- All functions return typed response objects or throw a typed `ApiError`.
- **Verification**: Calling `getProducts()` from the browser console returns the list.

### T-12 Dashboard page
- Create `frontend/src/pages/DashboardPage.tsx`.
- Render `SummaryBanner` (count of "Reorder now" products), `ProductTable` (sorted as per T-09), and `LoadDemoButton` (when product count = 0).
- `StatusBadge` component uses colour + text label for all three states.
- **Verification**: Dashboard shows three products after seeding; Coffee row has red "Reorder now" badge and "Sales increasing" text.

### T-13 Formula tooltip / trace panel
- Create `frontend/src/components/FormulaTooltip.tsx` (inline popover for simple metrics).
- Create `frontend/src/components/FormulaDrawer.tsx` (side panel for "Suggested order quantity" full derivation).
- Each metric cell in the dashboard table has a "?" trigger.
- The drawer for suggested order quantity shows every step: ADD_7 value, target stock calculation, and final order qty, with user-set assumptions labelled.
- **Verification**: Clicking "?" on the ROP cell shows the formula with substituted values. No AI/ML language anywhere in the trace text.

### T-14 Add Product page
- Create `frontend/src/pages/AddProductPage.tsx` with `ProductForm` component.
- All validation rules from design.md §7 are implemented client-side.
- On submit, call POST /api/v1/products; on success navigate to Dashboard.
- **Verification**: Submitting a blank form shows all required field errors. Submitting a duplicate SKU shows the SKU error from the backend.

### T-15 Edit Product page
- Create `frontend/src/pages/EditProductPage.tsx`.
- Reuses `ProductForm` pre-filled with existing values from GET /api/v1/products/:id.
- On submit, call PUT /api/v1/products/:id; on success navigate to Dashboard.
- **Verification**: Editing the coffee product's safety stock changes the ROP on the dashboard.

### T-16 Product Detail page
- Create `frontend/src/pages/ProductDetailPage.tsx`.
- Shows product configuration, `SalesHistoryTable` (last 30 days), `AddSalesEntryForm`, `RestockForm`, and a `StockMovementLog`, and links to edit/delete.
- `AddSalesEntryForm` shows the new stock level after submission.
- `RestockForm` accepts quantity ≥ 1 and an optional note.
- Both forms show the updated `current_stock` immediately after a successful submit.
- Delete button shows a confirmation dialog.
- **Verification**: Adding a sales entry decreases the displayed current stock. Adding a restock increases it. Attempting to sell more than current stock shows the "would reduce stock below zero" error from the API.

### T-17 Routing
- Set up React Router v6 in `App.tsx`:
  - `/` → DashboardPage
  - `/products/new` → AddProductPage
  - `/products/:id` → ProductDetailPage
  - `/products/:id/edit` → EditProductPage
  - `*` → NotFoundPage
- **Verification**: Navigating directly to `/products/new` works; back button from Add Product returns to Dashboard.

---

## Phase 5 — Polish and Validation Gate

### T-18 Accessibility review
- Verify all form fields have `<label>` elements with correct `htmlFor`.
- Verify status badges have both colour and text.
- Verify all interactive elements are keyboard-accessible (Tab order, focus rings).
- Verify the sales table has `<thead>` with `scope="col"` on header cells.
- **Verification**: Tab-only navigation reaches every action on the dashboard.

### T-19 No-AI-language audit
- Search all `.tsx`, `.ts`, `.md` files for: "AI", "ML", "machine learning", "predict", "forecast", "neural", "smart" (flag any that are not clearly qualified as "formula-based").
- Fix any occurrences.
- **Verification**: No prohibited terms remain in UI text, tooltips, or README.

### T-20 README
- Create root `README.md` with:
  - Project description (one paragraph, no AI/ML claims).
  - Prerequisites (Node.js 20, npm).
  - Local development setup steps (install, start backend, start frontend).
  - How to load demo data.
  - Brief explanation of each formula.
  - Link to DECISIONS.md.
- **Verification**: A fresh checkout and following the README instructions produces a running app.

### T-21 Final cross-check
- Verify that every acceptance criterion in `requirements.md` has a corresponding implementation in tasks T-01 through T-20.
- Verify that every formula in `design.md §4` has a unit test in T-04/T-05 and is used in the dashboard API (T-09) and displayed in the trace panel (T-13).
- Document any unmet criteria as known gaps in the README.
- **Verification**: All unit tests pass. Dashboard matches design.md §8 expected outcomes for the demo dataset.

---

## Task Dependency Summary

```
T-01 → T-02 → T-03
             T-04 (independent of T-03)
             T-05 (depends on T-04 for parity check)
T-02 + T-04 → T-06 → T-07
T-02 + T-04 → T-08
T-07 + T-08 + T-04 → T-09
T-02 → T-10
T-03 + T-09 + T-10 → T-11 → T-12 → T-13
T-11 → T-14 → T-15 → T-16 → T-17
T-17 → T-18 → T-19 → T-20 → T-21
```
