---
inclusion: always
---

# Calculation Rules, Data Handling, Testing, and UI Standards

## 1. Core Formula Definitions

These are the authoritative formulas for the entire project. Any implementation that deviates from them is a bug.

### 1.1 Average Daily Demand (7-day)
```
ADD_7 = total units sold in the last 7 calendar days / 7
```
- "Last 7 calendar days" means the 7 most recent days on which a sales record exists for the product, counting backwards from and including the most recent entry date.
- If fewer than 7 days of records exist, use the available days as numerator count but still divide by 7 (not by the available count). This is intentional: it keeps the formula stable and prevents the figure from looking inflated during early product life.
- If there are zero sales records in the last 7 days, ADD_7 = 0.

### 1.2 Average Daily Demand (3-day)
```
ADD_3 = total units sold in the last 3 calendar days / 3
```
- Same boundary rules as ADD_7 but window is 3 days.
- Displayed alongside ADD_7 so the user can spot a recent acceleration in sales.

### 1.3 Reorder Point
```
ROP = ADD_7 × supplier_lead_time_days + safety_stock
```
- `supplier_lead_time_days` and `safety_stock` are user-configured per product.
- Result is always rounded up to the nearest whole unit (`Math.ceil`).
- If ADD_7 = 0, ROP = safety_stock (lead-time buffer collapses to zero, but safety stock floor remains).

### 1.4 Stock Coverage
```
stock_coverage_days = current_stock / ADD_7
```
- If ADD_7 = 0, do NOT divide. Display "No recent sales" instead of a number.
- Result is rounded to one decimal place for display.

### 1.5 Suggested Target Stock
```
target_stock = ADD_7 × (supplier_lead_time_days + target_coverage_days) + safety_stock
```
- `target_coverage_days` is user-configured per product (e.g. 14 days of forward cover desired).

### 1.6 Suggested Order Quantity
```
suggested_order_qty = max(0, ceil(target_stock) − current_stock)
```
- Never negative.
- If current stock already exceeds the target, the suggestion is 0 with the message "Stock sufficient".

### 1.7 Status Classification
| Status | Condition |
|---|---|
| **Reorder now** | `current_stock <= ROP` |
| **Watch** | `current_stock > ROP` AND `current_stock <= ROP × 1.25` |
| **Healthy** | `current_stock > ROP × 1.25` |

The "Watch" band is defined as 25 % above the reorder point. This threshold is documented here and labelled as a configurable assumption in design.md.

### 1.8 Trending Sales Warning
Show a "Sales increasing" notice when `ADD_3 > ADD_7 × 1.20` (3-day average is more than 20 % above the 7-day average). Label this as an indicator, not a prediction.

## 2. Data Handling Rules

- **No invented data**: all production data is user-entered. The only pre-loaded values are the seed/demo dataset, which is clearly labelled "Sample data — for demonstration only" everywhere it appears.
- **Date handling**: all dates are stored as ISO 8601 strings (`YYYY-MM-DD`) in SQLite. Time zones are ignored at MVP; the app uses local calendar dates only.
- **Decimal precision**: all intermediate calculations use JavaScript `number` (64-bit float). Final display values are rounded as specified per formula. Raw stored values (units sold, current stock) are non-negative integers.
- **Input validation**: quantities must be non-negative integers. Lead time and safety stock must be non-negative integers. Target coverage days must be a positive integer ≥ 1. All fields are validated on both frontend and backend.
- **Deletion safety**: deleting a product also deletes all associated sales records (cascade). A confirmation dialog must be shown before deletion.

## 3. Testing Standards

- Every formula function has unit tests covering: normal case, zero demand, single data point, and the edge case where stock exactly equals the reorder point.
- Unit tests must not touch the database or the network — all inputs are passed as arguments.
- Integration tests cover the API endpoints for creating products and fetching dashboard data.
- Test files live next to the module they test: `inventory.test.ts` beside `inventory.ts`.

## 4. UI Standards

### Formula Transparency
- Every calculated field on the dashboard must have an expandable tooltip or detail panel showing:
  - The formula used (in plain English and symbolic form).
  - The values that were plugged in.
  - The result.
- The "Suggested order quantity" panel must show the full derivation, step by step.

### Labelling
- "Sample data" labels must appear on any pre-loaded demo record.
- User-configured assumptions (safety stock, target coverage days) must be labelled as "User-set assumption" in the UI.
- The 3-day vs 7-day figures must be labelled as "Recent 3-day avg" and "7-day avg" — never as "AI forecast" or "predicted demand".
- The trending sales notice must say "Sales increasing (recent avg is higher than 7-day avg)" — never "AI detected trend" or similar.

### Accessibility
- All interactive controls have visible focus rings.
- Status badges (Reorder now / Watch / Healthy) use both colour and a text label — never colour alone.
- Tables include `<thead>` with column headers and `scope` attributes.

### No AI / ML Claims
The application must never display, imply, or suggest that machine learning, artificial intelligence, neural networks, or probabilistic forecasting are being used. If the words "AI", "ML", "predict", or "forecast" appear in the UI, they are a bug.
