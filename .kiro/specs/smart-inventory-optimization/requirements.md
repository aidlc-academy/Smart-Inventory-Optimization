# Requirements — Smart Inventory Optimization

## Overview

Smart Inventory Optimization helps small retailers manage stock levels using transparent, formula-based calculations. This document lists all user stories and the testable acceptance criteria for the MVP.

---

## Epic 1 — Product Management

### US-01 Add a product
**As a** store manager,  
**I want to** add a new product with its name, SKU, current stock, supplier lead time, safety stock, and target coverage days,  
**so that** I can start tracking inventory for that product.

**Acceptance criteria**
- AC-01-1: Submitting the Add Product form with all required fields stores the product and shows it in the product list.
- AC-01-2: Name (required, 1–120 chars), SKU (required, 1–50 chars, unique), current stock (required, integer ≥ 0), supplier lead time (required, integer ≥ 1), safety stock (required, integer ≥ 0), target coverage days (required, integer ≥ 1) are all validated before submission.
- AC-01-3: Submitting a form with any required field empty shows a specific, field-level error message and does not create the product.
- AC-01-4: Submitting with a duplicate SKU shows the error "SKU already exists" and does not create the product.
- AC-01-5: Submitting with a non-integer or negative value for a numeric field shows a field-level validation error.

### US-02 Edit a product
**As a** store manager,  
**I want to** edit a product's configuration (name, current stock, lead time, safety stock, target coverage days),  
**so that** I can keep the settings accurate as my business changes.

**Acceptance criteria**
- AC-02-1: Navigating to the Edit Product screen pre-fills all existing values.
- AC-02-2: Saving a valid edit updates the product and reflects the new values immediately in the product list and dashboard.
- AC-02-3: The same validation rules as AC-01-2 apply to the edit form.
- AC-02-4: Cancelling the edit leaves the product unchanged.

### US-03 View product list
**As a** store manager,  
**I want to** see all products in a list,  
**so that** I can select one to view or edit.

**Acceptance criteria**
- AC-03-1: The product list shows each product's name, SKU, and current stock.
- AC-03-2: The list is sorted alphabetically by product name by default.
- AC-03-3: If no products exist, the list shows "No products yet. Add your first product." instead of an empty table.

### US-04 Delete a product
**As a** store manager,  
**I want to** delete a product I no longer stock,  
**so that** it no longer appears on my dashboard.

**Acceptance criteria**
- AC-04-1: Clicking "Delete" shows a confirmation dialog with the product name before any data is removed.
- AC-04-2: Confirming deletion removes the product and all its associated sales records.
- AC-04-3: Cancelling the confirmation leaves the product intact.
- AC-04-4: After deletion the product list no longer includes the deleted product.

---

## Epic 2 — Daily Sales Entry

### US-05 Record daily sales
**As a** store manager,  
**I want to** enter the number of units sold for a product on a given date,  
**so that** the system can calculate accurate demand figures and keep the stock count current.

**Acceptance criteria**
- AC-05-1: The sales entry form accepts a product (pre-selected if navigating from a product), a date, and a quantity (integer ≥ 0).
- AC-05-2: Submitting stores the sales record, decrements `current_stock` by the units sold in the same database transaction, and shows a success message with the new stock level.
- AC-05-3: If a record already exists for the same product and date, submitting replaces it (upsert). The stock adjustment is the difference between the new and old quantity (e.g. old = 3, new = 5 → stock decrements by 2). Shows "Updated existing entry for [date]".
- AC-05-4: If recording the sale would reduce `current_stock` below zero, the API rejects the request with the error "Cannot record sale: would reduce stock below zero (current: N, requested: M)".
- AC-05-5: Entering a non-integer or negative quantity shows a validation error.
- AC-05-6: Entering a future date shows the warning "Date is in the future — are you sure?" but still allows submission.
- AC-05-7: After entry, the dashboard figures for that product recalculate immediately (on next page load or auto-refresh).

### US-06 View sales history
**As a** store manager,  
**I want to** view recent sales entries for a product,  
**so that** I can verify the data that drives the calculations.

**Acceptance criteria**
- AC-06-1: The product detail screen shows the last 30 days of sales entries in a table, most recent first.
- AC-06-2: Each row shows the date and units sold.
- AC-06-3: If there are no entries in the last 30 days, the table shows "No sales recorded in the last 30 days."

### US-05b Record a restock
**As a** store manager,  
**I want to** record when new stock arrives from a supplier,  
**so that** the current stock figure stays accurate.

**Acceptance criteria**
- AC-05b-1: The restock form accepts a product, a date, a quantity (integer ≥ 1), and an optional note (e.g. "Supplier delivery").
- AC-05b-2: Submitting saves a stock movement record with type "restock" and increases `current_stock` by the quantity in the same database transaction.
- AC-05b-3: Entering a non-integer or quantity ≤ 0 shows a validation error.
- AC-05b-4: After restock, `current_stock` on the dashboard reflects the new value immediately on refresh.

---

## Epic 3 — Inventory Dashboard

### US-07 View inventory dashboard
**As a** store manager,  
**I want to** see a dashboard with all products and their calculated inventory metrics,  
**so that** I can quickly assess overall stock health.

**Acceptance criteria**
- AC-07-1: The dashboard shows a row per product containing: product name, current stock, 7-day average daily demand (ADD_7), 3-day average daily demand (ADD_3), stock coverage in days, reorder point, and status badge.
- AC-07-2: If ADD_7 = 0, stock coverage shows "No recent sales" instead of a number.
- AC-07-3: Status badge uses one of exactly three values: "Reorder now", "Watch", or "Healthy", with distinct colours and text labels.
- AC-07-4: The dashboard updates when the page is loaded or manually refreshed.
- AC-07-5: Any product labelled as sample data shows "(Sample)" next to its name.

### US-08 See formula trace
**As a** store manager,  
**I want to** click on any calculated metric and see exactly how it was computed,  
**so that** I understand and trust the numbers.

**Acceptance criteria**
- AC-08-1: Each calculated field on the dashboard has a "?" icon or tooltip trigger.
- AC-08-2: Activating the trigger shows the formula in plain English, the variable values used, and the result.
- AC-08-3: The trace for "Suggested order quantity" shows all intermediate steps (ADD_7 → target stock → order qty).

---

## Epic 4 — Reorder Alerts and Suggested Order Quantity

### US-09 Reorder alert
**As a** store manager,  
**I want to** be alerted when a product needs to be reordered soon,  
**so that** I don't run out of stock before my supplier delivers.

**Acceptance criteria**
- AC-09-1: Products with status "Reorder now" appear at the top of the dashboard (before "Watch" and "Healthy" products).
- AC-09-2: A summary banner at the top of the dashboard shows the count of products in "Reorder now" state.
- AC-09-3: Products with status "Watch" appear after "Reorder now" products.
- AC-09-4: Products with status "Healthy" appear last.

### US-10 Suggested order quantity
**As a** purchasing officer,  
**I want to** see how much of a product I should order,  
**so that** I can place an order without manual calculation.

**Acceptance criteria**
- AC-10-1: The dashboard row shows the suggested order quantity for each product.
- AC-10-2: If current stock ≥ target stock, the suggestion shows 0 with label "Stock sufficient".
- AC-10-3: The suggested order quantity is never negative.
- AC-10-4: Clicking the suggested quantity shows the full derivation (all formula steps with substituted values).
- AC-10-5: All user-configured values (safety stock, target coverage days) are labelled "User-set assumption" in the derivation view.

### US-11 Trending sales indicator
**As a** store manager,  
**I want to** be warned when recent sales are accelerating,  
**so that** I can consider ordering more before a potential stockout.

**Acceptance criteria**
- AC-11-1: When ADD_3 > ADD_7 × 1.20, the product row shows a "Sales increasing" indicator.
- AC-11-2: The indicator text says "Recent 3-day avg ([X] units/day) is higher than 7-day avg ([Y] units/day)".
- AC-11-3: The indicator never uses the words "AI", "predicted", or "forecast".

---

## Epic 5 — Demo Dataset

### US-12 Load demo data
**As a** challenge evaluator,  
**I want to** load a realistic demo dataset with one click,  
**so that** I can explore all features without entering data manually.

**Acceptance criteria**
- AC-12-1: A "Load demo data" button is visible on the dashboard or home page when no products exist.
- AC-12-2: Loading demo data creates at least 3 products with 14 days of sales history each.
- AC-12-3: At least one product in the demo has increasing recent sales and stock coverage of fewer than supplier lead time days (triggering "Reorder now").
- AC-12-4: All demo products and their data are labelled "(Sample)" in the UI.
- AC-12-5: Loading demo data when products already exist asks the user to confirm before adding.

---

## Non-Functional Requirements

### NFR-01 Performance
- The dashboard page must load in under 2 seconds on a local development machine for up to 50 products.

### NFR-02 Accuracy
- All formula calculations must match the reference implementations in `calculation-rules.md` to within floating-point rounding (results match after applying the specified rounding rules).

### NFR-03 Accessibility
- All interactive elements must be keyboard-accessible.
- Status badges must convey status through both colour and text.
- Form fields must have associated `<label>` elements.

### NFR-04 No AI Claims
- No text anywhere in the application (UI, tooltips, README, API responses) may claim or imply AI, ML, or prediction capability.
