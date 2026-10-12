# Smart Inventory Optimization

A student project for the AWS Kiro AI-DLC Challenge.

Smart Inventory Optimization is a small-business inventory management tool that helps store managers track stock levels, understand daily sales patterns, and decide when to reorder products. All calculations use documented deterministic formulas — no trained models or probabilistic forecasting.

---

## Prerequisites

- **Node.js 20 LTS** (or later)
- **npm** (bundled with Node.js)

---

## Setup

### 1. Start the backend

```bash
cd smart-inventory-optimization/backend
npm install
npm run dev
```

The backend starts on **http://localhost:3001**.

Verify it is running:

```
GET http://localhost:3001/api/v1/health
→ { "status": "ok" }
```

### 2. Start the frontend

Open a second terminal:

```bash
cd smart-inventory-optimization/frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:5173**.

---

## Load Demo Data

1. Open the app in your browser at http://localhost:5173.
2. When no products exist, click **"🎲 Load demo data"** on the dashboard.
   Alternatively, send a POST request to the backend:
   ```
   POST http://localhost:3001/api/v1/seed
   ```
3. The demo loads three sample products:
   - **Premium Coffee Blend 1kg** — recent sales acceleration, "Reorder now" status, and a sales-increase notice.
   - **Standard Flour 5kg** — steady demand, "Healthy" status.
   - **Organic Olive Oil 500ml** — low demand, "Healthy" status.

To remove demo data:
```
DELETE http://localhost:3001/api/v1/seed
```

---

## Formula Summary

All calculations are deterministic and fully traceable. Click the **"?"** button next to any metric on the dashboard to see the formula and substituted values.

| Metric | Formula |
|---|---|
| ADD_7 | total units sold in last 7 days ÷ 7 |
| ADD_3 | total units sold in last 3 days ÷ 3 |
| Reorder Point (ROP) | ceil(ADD_7 × lead time + safety stock) |
| Stock Coverage | current stock ÷ ADD_7 (shows "No recent sales" if ADD_7 = 0) |
| Target Stock | ADD_7 × (lead time + target coverage) + safety stock |
| Suggested Order | max(0, ceil(target stock) − current stock) |
| Status | Reorder now: stock ≤ ROP · Watch: stock ≤ ROP × 1.25 · Healthy: otherwise |
| Sales Increase Notice | shown when ADD_3 > ADD_7 × 1.20 |

Full formula details: [`.kiro/steering/calculation-rules.md`](../.kiro/steering/calculation-rules.md)

---

## Running Tests

**Backend:**
```bash
cd smart-inventory-optimization/backend
npm test
```

**Frontend (formula unit tests):**
```bash
cd smart-inventory-optimization/frontend
npm test
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js 20 + Express 4 |
| Database | SQLite (via better-sqlite3) |
| Routing | React Router v6 |
| Charts | Recharts |
| Tests | Vitest (frontend), Jest + Supertest (backend) |

---

## Design Decisions

See [`DECISIONS.md`](../DECISIONS.md) for why deterministic formulas were chosen, why no trained model is used, and the key assumptions and trade-offs.
