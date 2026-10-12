# Implementation Plan — Smart Inventory Optimization MVP

> **Source of truth**: `.kiro/steering/calculation-rules.md`, `.kiro/steering/tech-stack.md`, `.kiro/specs/smart-inventory-optimization/design.md`
> **Workspace root**: `c:\Users\ELCOT\OneDrive\Documents\kiro project`
> **App root**: `c:\Users\ELCOT\OneDrive\Documents\kiro project\smart-inventory-optimization\`
> All paths below are relative to the app root unless stated otherwise.

---

## Key Implementation Notes (read before coding)

### FORMULA WINDOW RULE
- ADD_7 window: `WHERE sale_date >= date('now','-6 days')` (today-6 through today = 7 days). **Always divide by 7.**
- ADD_3 window: `WHERE sale_date >= date('now','-2 days')` (today-2 through today = 3 days). **Always divide by 3.**
- Dates are ISO strings `YYYY-MM-DD`. No timezones at MVP.

### TRANSACTION RULES — SALES (POST /api/v1/products/:id/sales)
Use `db.transaction()` wrapper from better-sqlite3:
1. SELECT `units_sold` from `sales_records` WHERE `product_id = ?` AND `sale_date = ?` → `oldQty`
2. `delta = newQty - (oldQty ?? 0)`
3. Fetch `current_stock` from `products WHERE id = ?`
4. If `current_stock - delta < 0`: throw `new Error('Cannot record sale: would reduce stock below zero (current: N, requested: M)')` — better-sqlite3 auto-rolls back on throw → return HTTP 400
5. `INSERT OR REPLACE INTO sales_records (product_id, sale_date, units_sold, created_at) VALUES (?,?,?,?)`
6. `UPDATE products SET current_stock = current_stock - delta, updated_at = ? WHERE id = ?`
7. `INSERT INTO stock_movements (product_id, movement_date, quantity, type, note, created_at) VALUES (?, ?, ?, 'sale', null, ?)`  — quantity = `-delta`

### TRANSACTION RULES — RESTOCK (POST /api/v1/products/:id/restock)
Use `db.transaction()`:
1. `UPDATE products SET current_stock = current_stock + quantity, updated_at = ? WHERE id = ?`
2. `INSERT INTO stock_movements (product_id, movement_date, quantity, type, note, created_at) VALUES (?, ?, ?, 'restock', ?, ?)`
3. Return updated product row

### DEMO SEED DATA (exact values, dates relative to `new Date()` at seed time)
```
Product A: name='Premium Coffee Blend 1kg', sku='COFFEE-001', current_stock=18,
           supplier_lead_time_days=5, safety_stock=5, target_coverage_days=14, is_sample=1
  Sales days -13 to -7 (i.e. today-13 through today-7): 3 units/day
  Sales days -6 to 0  (i.e. today-6  through today):   6 units/day

Product B: name='Standard Flour 5kg', sku='FLOUR-005', current_stock=120,
           supplier_lead_time_days=3, safety_stock=10, target_coverage_days=14, is_sample=1
  Sales days -13 to 0: 8 units/day

Product C: name='Organic Olive Oil 500ml', sku='OIL-500', current_stock=40,
           supplier_lead_time_days=7, safety_stock=8, target_coverage_days=14, is_sample=1
  Sales days -13 to 0: 2 units/day
```
`POST /api/v1/seed`: DELETE existing `is_sample=1` products first, then INSERT all three.
`DELETE /api/v1/seed`: `DELETE FROM products WHERE is_sample=1` (cascades to sales_records and stock_movements).

### DASHBOARD SORT ORDER
Status priority: `Reorder now` = 0, `Watch` = 1, `Healthy` = 2. Then alphabetical by name within each group.

### UI CRITICAL RULES (no AI/ML language anywhere)
- FormulaTrace popover labels: `'ADD_7 = total sold in last 7 days (X units) ÷ 7 = Y units/day'`
- Trend warning: `'Sales increasing — Recent 3-day avg (X units/day) is higher than 7-day avg (Y units/day)'`
- Suggested order drawer steps: Step 1 ADD_7, Step 2 Target stock, Step 3 Suggested order
- Label `safety_stock` and `target_coverage_days` as **'User-set assumption'** in the UI
- Prohibited anywhere: AI, ML, predict, forecast, neural, machine learning

### CSS VARIABLES (define in `frontend/src/index.css`)
```css
--color-bg: #f8fafc;   --color-surface: #ffffff;  --color-border: #e2e8f0;
--color-primary: #3b82f6; --color-danger: #ef4444; --color-warning: #f59e0b; --color-success: #22c55e;
--color-text: #1e293b; --color-muted: #64748b;
```
Sidebar: `background: #1e293b`, white text, 220px wide, fixed left.
Cards: white, 1px border `var(--color-border)`, 8px border-radius, 16px padding, `box-shadow: 0 1px 3px rgba(0,0,0,.1)`
Status badges: height 20px, 8px horizontal padding, 4px border-radius, font-size 11px uppercase
Responsive: sidebar hamburger toggle below 768px

---

## Phase 0 — Backend Scaffold

- [ ] 1. Create `backend/package.json` with exact dependencies.
      Runtime deps: `express@^4.18.0`, `better-sqlite3@^9.4.3`, `cors@^2.8.5`
      Dev deps: `typescript@^5.3.0`, `@types/express`, `@types/better-sqlite3`, `@types/cors`, `@types/node`, `ts-node-dev@^2.0.0`, `jest@^29`, `@types/jest`, `ts-jest@^29`, `supertest@^6`, `@types/supertest`
      Scripts: `"dev": "ts-node-dev --respawn --transpile-only src/index.ts"`, `"build": "tsc"`, `"test": "jest"`
      Files: `backend/package.json`
      Verify: `cd backend && npm install` completes without errors.

- [ ] 2. Create `backend/tsconfig.json` with `strict:true`, `outDir:dist`, `rootDir:src`, `module:commonjs`, `target:es2020`, `esModuleInterop:true`, `resolveJsonModule:true`.
      Files: `backend/tsconfig.json`
      Verify: `cd backend && npx tsc --noEmit` passes (after formula service is added in step 5).

- [ ] 3. Create `backend/jest.config.js`:
      ```js
      module.exports = { preset: 'ts-jest', testEnvironment: 'node', roots: ['<rootDir>/src'], testMatch: ['**/*.test.ts'] };
      ```
      Files: `backend/jest.config.js`
      Verify: `cd backend && npm test` runs (zero tests initially, exit 0 or "no test suites found" acceptable).

- [ ] 4. Create `backend/src/db/database.ts` that opens `better-sqlite3` on `inventory.db` at the backend root, enables WAL mode (`PRAGMA journal_mode=WAL`), and enforces foreign keys (`PRAGMA foreign_keys=ON`). Export the `db` instance.
      Files: `backend/src/db/database.ts`
      Verify: Module imports without error; `inventory.db` is created on first import.

- [ ] 5. Create `backend/src/db/migrations.ts` with `runMigrations(db)` that executes `CREATE TABLE IF NOT EXISTS` for all three tables using exact schema from design.md §2:
      - `products`: id, name, sku (UNIQUE), current_stock, supplier_lead_time_days, safety_stock, target_coverage_days, is_sample DEFAULT 0, created_at, updated_at
      - `sales_records`: id, product_id (FK→products ON DELETE CASCADE), sale_date, units_sold, created_at; UNIQUE(product_id, sale_date)
      - `stock_movements`: id, product_id (FK→products ON DELETE CASCADE), movement_date, quantity, type, note, created_at
      Files: `backend/src/db/migrations.ts`
      Verify: Tables exist after server start; running migrations a second time does not error.

- [ ] 6. Create `backend/src/index.ts`: Express app on port 3001, CORS enabled (import cors, `app.use(cors())`), `app.use(express.json())`, calls `runMigrations(db)` at startup, registers `GET /api/v1/health` → `{ status: 'ok' }`. Register all route files (products, sales, dashboard, seed) — the route files can be stubs initially.
      Files: `backend/src/index.ts`
      Verify: `npm run dev` in `backend/` starts server; `GET http://localhost:3001/api/v1/health` returns `{"status":"ok"}`.

---

## Phase 1 — Formula Library

- [ ] 7. Create `backend/src/services/inventory.ts` with these pure exported functions (JSDoc on each citing the formula and edge case):
      - `calcADD7(records: {units_sold:number}[], windowTotal: number): number` — `windowTotal / 7`; if no records ADD7=0. (The route layer passes pre-filtered records; the function receives total units in the window.)
      - `calcADD3(records: {units_sold:number}[], windowTotal: number): number` — `windowTotal / 3`
      - `calcROP(add7: number, leadTimeDays: number, safetyStock: number): number` — `Math.ceil(add7 * leadTimeDays + safetyStock)`
      - `calcStockCoverage(currentStock: number, add7: number): number | null` — `add7 === 0 ? null : currentStock / add7` (null = "No recent sales")
      - `calcTargetStock(add7: number, leadTimeDays: number, targetCoverageDays: number, safetyStock: number): number` — `add7 * (leadTimeDays + targetCoverageDays) + safetyStock`
      - `calcSuggestedOrderQty(targetStock: number, currentStock: number): number` — `Math.max(0, Math.ceil(targetStock) - currentStock)`
      - `calcStatus(currentStock: number, rop: number): 'Reorder now' | 'Watch' | 'Healthy'`
      - `calcTrendWarning(add3: number, add7: number): boolean` — `add3 > add7 * 1.20`
      Files: `backend/src/services/inventory.ts`
      Verify: File compiles with `npx tsc --noEmit`.

- [ ] 8. Create `backend/src/services/inventory.test.ts` covering all formula functions with these cases:
      - `calcADD7`: normal (21 units over window → 3.0), zero records (→0), partial week records, all zeros
      - `calcADD3`: normal (12 units → 4.0), zero records (→0)
      - `calcROP`: normal (add7=5, lead=5, safety=5 → ceil(30)=30), add7=0 (ROP=safety_stock), zero safety_stock
      - `calcStockCoverage`: normal (stock=30, add7=5 → 6.0), add7=0 → null
      - `calcSuggestedOrderQty`: normal, stock≥target returns 0, never negative
      - `calcStatus`: stock<ROP→'Reorder now', stock=ROP→'Reorder now', stock=ROP*1.25→'Watch', stock>ROP*1.25→'Healthy'
      - `calcTrendWarning`: add3=add7*1.21→true, add3=add7→false
      Files: `backend/src/services/inventory.test.ts`
      Verify: `cd backend && npm test` — all formula tests pass.

---

## Phase 2 — Product CRUD API

- [ ] 9. Create `backend/src/routes/products.ts` with these endpoints:
      - `GET /api/v1/products` → all products ORDER BY name ASC
      - `POST /api/v1/products` → validate all fields (§7), INSERT, return 201 + created product; return 409 on duplicate SKU
      - `GET /api/v1/products/:id` → 404 if not found
      - `PUT /api/v1/products/:id` → validate, UPDATE, return updated product
      - `DELETE /api/v1/products/:id` → DELETE (cascade removes sales_records and stock_movements), return 204
      All validation uses the rules from design.md §7. No string-concatenated SQL — use prepared statements.
      Files: `backend/src/routes/products.ts`
      Verify: `POST` with valid data returns 201; `POST` with duplicate SKU returns 409 `{"error":"SKU already exists"}`; `DELETE` removes the product row.

- [ ] 10. Create `backend/src/routes/sales.ts` with these endpoints using `db.transaction()` for all mutations:
       - `GET /api/v1/products/:id/sales` → sales_records for product, last 30 days, DESC by sale_date
       - `POST /api/v1/products/:id/sales` → full transaction per "TRANSACTION RULES — SALES" above; return 400 with exact error string on negative-stock attempt; return updated product + sales record
       - `POST /api/v1/products/:id/restock` → full transaction per "TRANSACTION RULES — RESTOCK" above; return updated product
       - `GET /api/v1/products/:id/movements` → stock_movements last 60 days DESC by movement_date
       Files: `backend/src/routes/sales.ts`
       Verify: `cd backend && npm test` (sales.test.ts in step 11 passes).

- [ ] 11. Create `backend/src/routes/sales.test.ts` (Jest + supertest) covering:
       - POST sale: stock decrements correctly
       - POST sale: rejects when sale would go below zero (400)
       - POST same product+date twice: one sales row, stock adjusted by delta only
       - POST restock: stock increments correctly
       - GET movements: returns correct entries with correct types and quantities
       Files: `backend/src/routes/sales.test.ts`
       Verify: `cd backend && npm test` — all sales route tests pass.

---

## Phase 3 — Dashboard API

- [ ] 12. Create `backend/src/routes/dashboard.ts` implementing `GET /api/v1/dashboard`:
       For each product:
       1. Query `sales_records WHERE product_id=? AND sale_date >= date('now','-6 days')` → sum for ADD_7 window; similarly `date('now','-2 days')` for ADD_3 window.
       2. Call `calcADD7`, `calcADD3`, `calcROP`, `calcStockCoverage`, `calcTargetStock`, `calcSuggestedOrderQty`, `calcStatus`, `calcTrendWarning` from inventory service.
       3. Return array sorted: Reorder now (0) → Watch (1) → Healthy (2), then alphabetical by name within group.
       Response shape per product: all product table fields + `{ add7, add3, rop, stockCoverageDays, targetStock, suggestedOrderQty, status, trendWarning }`.
       Files: `backend/src/routes/dashboard.ts`
       Verify: After seeding, `GET /api/v1/dashboard` returns Coffee first with `status:"Reorder now"` and `trendWarning:true`.

---

## Phase 4 — Seed / Demo Data

- [ ] 13. Create `backend/src/seed/demo-data.ts` with `seedDemoData(db)` function that:
       - Deletes all existing `is_sample=1` products first (cascade removes their sales/movements)
       - Inserts 3 products with exact values from "DEMO SEED DATA" above
       - Inserts sales records with dates computed relative to `new Date()` using `toISOString().slice(0,10)` arithmetic:
         - Coffee: days -13..-7 → 3 units/day; days -6..0 → 6 units/day
         - Flour: days -13..0 → 8 units/day
         - Oil: days -13..0 → 2 units/day
       - Does NOT use the sales transaction route (inserts directly to avoid mutating the initial `current_stock`; product is inserted with pre-set `current_stock`)
       Implement `POST /api/v1/seed` and `DELETE /api/v1/seed` in a seed route file.
       Files: `backend/src/seed/demo-data.ts`, `backend/src/routes/seed.ts`
       Verify: `POST /api/v1/seed` → `GET /api/v1/dashboard` shows Coffee with `status:"Reorder now"`. `DELETE /api/v1/seed` removes all three products.

---

## Phase 5 — Frontend Scaffold

- [ ] 14. Create the frontend project using Vite + React + TypeScript template:
       `npm create vite@latest frontend -- --template react-ts`
       Then install additional runtime deps: `react-router-dom@^6.22.0`, `recharts@^2.12.7`
       Install dev deps: `vitest@^1`, `@testing-library/react@^14`, `@testing-library/user-event@^14`, `jsdom`
       Files: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json` (strict:true)
       Verify: `cd frontend && npm install && npm run build` succeeds.

- [ ] 15. Configure `frontend/vite.config.ts` to proxy `/api` → `http://localhost:3001`:
       ```ts
       server: { proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } } }
       ```
       Configure Vitest: `test: { environment: 'jsdom', globals: true }` in the same `vite.config.ts`.
       Files: `frontend/vite.config.ts`
       Verify: `npm run dev` in frontend proxies `/api/v1/health` to backend.

- [ ] 16. Create `frontend/src/types/index.ts` with shared TypeScript interfaces:
       `Product`, `SalesRecord`, `StockMovement`, `DashboardProduct` (extends Product with all metric fields), `ApiError`.
       Files: `frontend/src/types/index.ts`
       Verify: TypeScript compiles without errors.

- [ ] 17. Create `frontend/src/api/client.ts` with typed fetch wrappers for all endpoints:
       `getProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`,
       `getDashboard`, `getSales`, `recordSale`, `recordRestock`, `getMovements`,
       `seedDemo`, `deleteDemo`.
       All functions throw `ApiError` (with `message` and optional `field`) on non-2xx responses.
       Base URL reads from `import.meta.env.VITE_API_URL ?? '/api/v1'`.
       Files: `frontend/src/api/client.ts`
       Verify: TypeScript compiles; calling `getDashboard()` from browser console returns array.

---

## Phase 6 — Frontend Formula Utils + Tests

- [ ] 18. Create `frontend/src/utils/inventory.ts` mirroring the backend formula functions with identical signatures and logic. Include JSDoc on each.
       Files: `frontend/src/utils/inventory.ts`
       Verify: TypeScript compiles without errors.

- [ ] 19. Create `frontend/src/utils/inventory.test.ts` (Vitest) with the same test cases as the backend formula tests (step 8): calcADD7, calcADD3, calcROP, calcStockCoverage, calcSuggestedOrderQty, calcStatus, calcTrendWarning — all same edge cases.
       Files: `frontend/src/utils/inventory.test.ts`
       Verify: `cd frontend && npm run test -- --run` — all formula tests pass.

---

## Phase 7 — Frontend Components

- [ ] 20. Create `frontend/src/index.css` with CSS custom properties per CSS VARIABLES above and global reset styles. Create `frontend/src/components/Layout.tsx`: fixed sidebar (220 px, `#1e293b` background, white text) with nav links (Dashboard, Add Product) and hamburger toggle below 768 px. Uses React Router `<NavLink>` for active styling. Contains `<Outlet />` for page content.
       Files: `frontend/src/index.css`, `frontend/src/components/Layout.tsx`
       Verify: App renders with sidebar visible; nav links are keyboard-focusable.

- [ ] 21. Create these small reusable components:
       - `frontend/src/components/StatusBadge.tsx`: renders "Reorder now" (red), "Watch" (yellow), "Healthy" (green) using both colour and text; height 20px, font-size 11px uppercase, 4px border-radius.
       - `frontend/src/components/ConfirmDialog.tsx`: modal with title, message, Confirm and Cancel buttons; traps focus; accessible with role="dialog".
       - `frontend/src/components/Toast.tsx`: dismissible top-right notification with success/error/warning variants; auto-dismisses after 4 s.
       - `frontend/src/components/SummaryCards.tsx`: three stat cards (Total Products, Low Stock, Needs Reorder) using the card style from CSS VARIABLES.
       Files: `frontend/src/components/StatusBadge.tsx`, `frontend/src/components/ConfirmDialog.tsx`, `frontend/src/components/Toast.tsx`, `frontend/src/components/SummaryCards.tsx`
       Verify: TypeScript compiles; StatusBadge renders correct text for each status.

- [ ] 22. Create `frontend/src/components/FormulaTrace.tsx`: a popover component that accepts `title`, `steps: {label: string, value: string}[]`. Shown via a "?" button next to each metric. Uses exact label text from "UI CRITICAL RULES" above. Never mentions AI/ML.
       Create `frontend/src/components/FormulaDrawer.tsx`: a right-side panel (slide-in) for the full Suggested Order Quantity derivation showing 3 labelled steps. Labels user-set assumptions explicitly.
       Files: `frontend/src/components/FormulaTrace.tsx`, `frontend/src/components/FormulaDrawer.tsx`
       Verify: Clicking "?" on a metric renders the popover with correct formula text; no AI/ML language in any trace text.

---

## Phase 8 — Frontend Pages

- [ ] 23. Create `frontend/src/hooks/useProducts.ts` (fetch product list, expose loading/error state) and `frontend/src/hooks/useDashboard.ts` (fetch dashboard data, expose loading/error/refetch).
       Files: `frontend/src/hooks/useProducts.ts`, `frontend/src/hooks/useDashboard.ts`
       Verify: TypeScript compiles.

- [ ] 24. Create `frontend/src/pages/DashboardPage.tsx`:
       - Uses `useDashboard` hook
       - Renders `SummaryCards` (totals for products, low-stock, reorder-needed)
       - Renders a product table: columns Name (with "(Sample)" for `is_sample=1`), Current Stock, ADD_7, ADD_3, Stock Coverage, ROP, Suggested Order, Status (StatusBadge), with "?" FormulaTrace triggers on each calculated column
       - Shows `trendWarning` indicator text (exact wording per UI CRITICAL RULES) when true
       - Shows "Reorder now" products first; "Load demo data" button when products array is empty; loading spinner and error state
       - Search input to filter by product name
       Files: `frontend/src/pages/DashboardPage.tsx`
       Verify: After seeding, dashboard shows Coffee with red "Reorder now" badge and trend warning text containing "Sales increasing".

- [ ] 25. Create `frontend/src/pages/ProductDetailPage.tsx`:
       - Fetches product by `:id` and its sales/movements
       - Shows product metrics summary (same calculations as dashboard)
       - `SalesHistoryTable`: last 30 days DESC, shows "No sales recorded in the last 30 days." when empty
       - `AddSalesEntryForm`: date + units_sold fields; shows future-date warning; shows updated current_stock on success; shows "Updated existing entry for [date]" on upsert; shows API error on negative-stock attempt
       - `RestockForm`: quantity ≥ 1, optional note; shows updated current_stock on success
       - `StockMovementLog`: last 60 days of movements with type, quantity, date, note
       - "Edit" link → `/products/:id/edit`; "Delete" button → ConfirmDialog → DELETE → navigate to `/`
       Files: `frontend/src/pages/ProductDetailPage.tsx`
       Verify: Recording a sale decreases displayed current_stock. Recording a restock increases it. Selling more than stock shows the exact error from the API.

- [ ] 26. Create `frontend/src/pages/AddProductPage.tsx` with `ProductForm` component (reused by edit page):
       - Fields: name, SKU, current_stock, supplier_lead_time_days, safety_stock, target_coverage_days
       - Client-side validation matching design.md §7 rules; shows field-level errors
       - On success: navigate to `/`; on 409 SKU conflict: show error on SKU field
       Files: `frontend/src/pages/AddProductPage.tsx`, `frontend/src/components/ProductForm.tsx`
       Verify: Empty form submission shows all required-field errors. Duplicate SKU shows "SKU already exists".

- [ ] 27. Create `frontend/src/pages/EditProductPage.tsx`:
       - Loads product by `:id`, pre-fills `ProductForm`
       - On success navigate to `/`; Cancel navigates back
       Files: `frontend/src/pages/EditProductPage.tsx`
       Verify: Editing safety_stock saves correctly and ROP updates on dashboard.

- [ ] 28. Create `frontend/src/pages/NotFoundPage.tsx` — simple 404 message with link back to `/`.
       Files: `frontend/src/pages/NotFoundPage.tsx`
       Verify: Navigating to `/not-a-real-route` renders the 404 page.

- [ ] 29. Create `frontend/src/App.tsx` with React Router v6 routes:
       - `/` → `DashboardPage`
       - `/products/new` → `AddProductPage`
       - `/products/:id` → `ProductDetailPage`
       - `/products/:id/edit` → `EditProductPage`
       - `*` → `NotFoundPage`
       Wrap all routes in `<Layout>`.
       Create `frontend/src/main.tsx` that renders `<App />` inside `<BrowserRouter>`.
       Files: `frontend/src/App.tsx`, `frontend/src/main.tsx`
       Verify: All routes navigate correctly; back button works from Add Product to Dashboard.

---

## Phase 9 — Polish and Accessibility

- [ ] 30. Accessibility pass:
       - All form `<input>` and `<select>` elements have corresponding `<label htmlFor>`.
       - Sales and product tables have `<thead>` with `<th scope="col">` on each header.
       - All interactive elements reachable by Tab; visible focus rings using `outline: 2px solid var(--color-primary)`.
       - ConfirmDialog traps focus and closes on Escape.
       Files: All `*.tsx` files from steps 20-29 (in-place edits)
       Verify: Tab-only navigation reaches every action on the dashboard page.

- [ ] 31. Language audit — search for prohibited terms:
       Run: `grep -ri "AI\|machine learning\|predict\|forecast\|neural\|smart recommendation" frontend/src/ backend/src/`
       Fix any occurrences (qualify or rephrase to "formula-based").
       Files: Any file containing prohibited terms
       Verify: The grep above returns no matches.

- [ ] 32. Create root `README.md` (at `smart-inventory-optimization/README.md`) containing:
       - One-paragraph description with no AI/ML claims
       - Prerequisites: Node.js 20, npm
       - Setup: `cd backend && npm install && npm run dev` / `cd frontend && npm install && npm run dev`
       - How to load demo data (click "Load demo data" button or `POST /api/v1/seed`)
       - Brief formula summary referencing `calculation-rules.md`
       - Link to `DECISIONS.md`
       Files: `smart-inventory-optimization/README.md`
       Verify: A fresh reader following the README reaches a running app.

---

## Phase 10 — Final Verification

- [ ] 33. Run all tests:
       - `cd backend && npm test` — all inventory formula tests and sales route tests pass
       - `cd frontend && npm run test -- --run` — all frontend formula tests pass
       Files: No new files; fix any test failures
       Verify: Zero failing tests in both suites.

- [ ] 34. End-to-end demo walkthrough:
       1. `POST /api/v1/seed` → dashboard shows 3 products; Coffee is "Reorder now" with trend warning
       2. Add a new product with stock=50; confirm it appears in product list
       3. On ProductDetail, record a sale of 10 units; confirm current_stock decreases by 10
       4. Record a restock of 20 units; confirm current_stock increases by 20
       5. Attempt to sell more units than current_stock; confirm 400 error shown
       6. Refresh page; confirm all data persists
       7. `DELETE /api/v1/seed`; confirm sample products are gone
       Files: No code changes (fix bugs found during walkthrough)
       Verify: All 7 steps above produce expected outcomes.

---

## Dependency Order
```
Steps 1-6 (backend scaffold)
  → 7-8 (formula library + tests)     [can run after step 3]
  → 9-11 (product + sales CRUD)       [depends on 4-8]
  → 12 (dashboard API)                [depends on 9-11]
  → 13 (seed data)                    [depends on 9]
  → 14-15 (frontend scaffold)         [independent of backend steps 9+, needs step 7 for parity]
  → 16-17 (types + API client)        [depends on 14-15]
  → 18-19 (frontend formulas)         [depends on 14-15, mirrors step 7]
  → 20-22 (shared components)         [depends on 18-19]
  → 23-29 (pages + routing)           [depends on 20-22, 16-17]
  → 30-32 (polish, audit, README)     [depends on 23-29]
  → 33-34 (final tests + demo)        [depends on all above]
```
