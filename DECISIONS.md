# DECISIONS.md — Smart Inventory Optimization

This document records key architectural and methodological decisions made during the planning phase, including the reasoning, alternatives considered, and trade-offs accepted.

---

## D-01 Deterministic formulas instead of a trained ML model

**Decision**: All inventory calculations use fixed, auditable arithmetic formulas. No machine-learning model is trained, loaded, or called.

**Why**:
1. **Transparency**: Every number on screen traces directly to a formula and raw user-entered data. A store manager can verify the result with a pocket calculator.
2. **Trust**: Retail managers are unlikely to trust a "black box" prediction without explanation. Showing the exact formula and the values plugged in builds trust and is a competitive advantage for a student project.
3. **Scope fit**: The challenge MVP does not have enough data (one retailer, a few products, days of history) to train a reliable model. A model trained on 14 days of three products would have no predictive validity and would create false confidence.
4. **Honest communication**: Claiming AI capability without a real model would be misleading to evaluators and users. The project avoids this.
5. **Maintainability**: Pure mathematical functions are easy to unit test, debug, and audit. An ML model requires a training pipeline, versioning, drift detection, and inference infrastructure — all far outside student-project scope.

**Alternatives considered**:
- Moving average with exponential smoothing: still deterministic, but more complex to explain without added accuracy benefit for very short histories.
- Linear regression on recent sales: technically an ML technique; ruled out per the honesty constraint above.

**Trade-off accepted**: The formula cannot adapt to seasonality, promotions, or unusual demand spikes on its own. The trending sales indicator (comparing ADD_3 to ADD_7) is the MVP's substitute — it surfaces recent acceleration without predicting future demand.

---

## D-02 No trained ML model is claimed

**Decision**: The application never uses the words "AI", "ML", "machine learning", "neural network", "predict", or "forecast" in any user-facing context without explicit qualification (e.g. "formula-based").

**Why**:
- It would be dishonest. The app does arithmetic, not inference.
- Evaluators of a student challenge can and will check. False claims undermine credibility.
- It sets a good professional standard: software should accurately describe what it does.

---

## D-03 SQLite for storage

**Decision**: Use SQLite via `better-sqlite3` as the data store.

**Why**:
- Zero configuration — no database server to install or start.
- A single file the team can copy, inspect, and delete without special tools.
- Sufficient for the demo scale (< 1000 products, < 365 days of data per product).
- `better-sqlite3` is synchronous and simple; it removes the need to manage connection pools or async query patterns for a single-user local app.

**Trade-off accepted**: SQLite does not scale to concurrent multi-user access. For a production multi-tenant product, the team would replace it with PostgreSQL. That migration is straightforward since all queries use prepared statements and a thin service layer.

---

## D-04 Division always by 7 (or 3) regardless of available records

**Decision**: ADD_7 divides the sum of available records in the last 7 days by 7, not by the count of days that have records.

**Why**:
- Dividing by the count of days with records would inflate the figure for products with sparse data (e.g. a product with 1 sale on day 1 of 7 would show ADD_7 = that day's sales, not sales/7).
- Dividing always by 7 gives a conservative, stable estimate: a product with few records shows a low ADD_7, which is the correct behaviour — do not overestimate demand for a new product.

**Trade-off accepted**: For a product that genuinely sells every day, the figure is accurate. For a product that sells only on weekends, ADD_7 slightly underestimates average daily demand (since zero-sale days are implicitly counted). This is an acceptable simplification for MVP.

---

## D-05 Watch band at ROP × 1.25

**Decision**: A product is "Watch" when `current_stock > ROP` and `current_stock ≤ ROP × 1.25`. The 25 % threshold is fixed and not user-configurable in MVP.

**Why**:
- The threshold needs to be documented and consistent. Without a fixed rule, different users would interpret "close to reorder" differently.
- 25 % above the reorder point gives roughly (0.25 × ROP / ADD_7) extra days of buffer — at a typical ADD_7, this is a few days' warning ahead of the reorder point.
- Post-MVP the threshold could be made configurable per product. For MVP, simplicity wins.

**Trade-off accepted**: A product with very high safety stock relative to its demand could spend most of its time in "Watch" without ever reaching "Reorder now". This is a UX issue to address post-MVP with a configurable band.

---

## D-06 Automatic stock adjustment on sales and restock

**Decision**: Recording a sale decrements `products.current_stock` by `units_sold` in the same SQLite transaction. Recording a restock increments it. Both operations also write a row to the `stock_movements` table. Stock is never allowed to go below zero.

**Why**:
- Keeping stock in sync automatically removes a manual step that users consistently forget when stock was managed manually.
- A transactional update (sale record + stock decrement in one SQLite transaction) guarantees that the stock figure is always consistent with the sales log; there is no window where they can diverge.
- The `stock_movements` table provides a durable audit trail: every change to stock is explained by a "sale" or "restock" event with a date, quantity, and optional note.
- Preventing negative stock enforces a real-world invariant — you cannot sell units that do not exist. It also protects the dashboard metrics (e.g. stock coverage stays ≥ 0).

**Trade-off accepted**: If a manager enters a sale quantity larger than the actual sold quantity, correcting it requires a restock or an edit. This is an acceptable trade-off because incorrect entries should be visible and correctable, not silently allowed to create negative stock.

---

## D-07 Upsert on sales entry

**Decision**: Posting a sales record for a product+date that already has a record replaces the existing record rather than rejecting the request.

**Why**:
- A manager may enter sales at the end of the day and then correct a mistake the next morning. A replace-on-conflict pattern is the most user-friendly behaviour.
- Returning a 409 Conflict would require the frontend to handle a conflict state and show an "edit existing entry" flow, adding complexity with no benefit.

**Trade-off accepted**: If a manager accidentally posts twice for the same date, the second entry silently wins. The UI shows a confirmation message "Updated existing entry for [date]" so the user is aware of the replacement.

---

## D-08 React + TypeScript + Vite frontend

**Decision**: Use React 18 with TypeScript 5 and Vite 5 for the frontend.

**Why**:
- React is the most widely used UI library in the industry and familiar to most student developers.
- TypeScript prevents formula implementation bugs that would be invisible in plain JavaScript (e.g. passing a string where a number is expected).
- Vite's dev server starts in under a second and has first-class TypeScript and React support.
- No framework lock-in: the app is a plain React SPA, testable and deployable anywhere.

**Alternatives considered**:
- Next.js: adds server-side rendering complexity that is unnecessary for a local-dev demo tool.
- Vue or Svelte: valid choices but less familiar to the expected student audience.

---

## D-09 Seed data dates relative to load time

**Decision**: The demo dataset computes all sale dates relative to the current date when `POST /api/v1/seed` is called, not as hardcoded calendar dates.

**Why**:
- If dates were hardcoded (e.g. "2025-01-01"), the demo would quickly become stale — the 7-day and 3-day windows would show ADD_7 = 0 once the date passes, and the "Reorder now" scenario would not trigger.
- Relative dates ensure the demo always shows realistic metrics regardless of when it is run.

**Trade-off accepted**: Running the seed twice in one day with different times produces slightly different data (e.g. if run at midnight vs noon). This is acceptable for a demo; production data is always user-entered.
