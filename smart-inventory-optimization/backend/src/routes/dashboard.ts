import { Router, Request, Response } from 'express';
import db from '../db/database';
import {
  calcADD7,
  calcADD3,
  calcROP,
  calcStockCoverage,
  calcTargetStock,
  calcSuggestedOrderQty,
  calcStatus,
  calcTrendWarning,
} from '../services/inventory';

const router = Router();

// GET /api/v1/dashboard — all products with calculated inventory metrics
router.get('/', (_req: Request, res: Response) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY name ASC').all() as Array<{
      id: number;
      name: string;
      sku: string;
      current_stock: number;
      supplier_lead_time_days: number;
      safety_stock: number;
      target_coverage_days: number;
      is_sample: number;
      created_at: string;
      updated_at: string;
    }>;

    const statusPriority = { 'Reorder now': 0, Watch: 1, Healthy: 2 };

    const dashboardItems = products.map((product) => {
      // Query ADD_7 window: today-6 through today (7 days)
      const add7Row = db
        .prepare(
          `SELECT COALESCE(SUM(units_sold), 0) as total
           FROM sales_records
           WHERE product_id = ? AND sale_date >= date('now', '-6 days')`
        )
        .get(product.id) as { total: number };

      // Query ADD_3 window: today-2 through today (3 days)
      const add3Row = db
        .prepare(
          `SELECT COALESCE(SUM(units_sold), 0) as total
           FROM sales_records
           WHERE product_id = ? AND sale_date >= date('now', '-2 days')`
        )
        .get(product.id) as { total: number };

      const add7 = calcADD7(add7Row.total);
      const add3 = calcADD3(add3Row.total);
      const rop = calcROP(add7, product.supplier_lead_time_days, product.safety_stock);
      const stockCoverageDays = calcStockCoverage(product.current_stock, add7);
      const targetStock = calcTargetStock(
        add7,
        product.supplier_lead_time_days,
        product.target_coverage_days,
        product.safety_stock
      );
      const suggestedOrderQty = calcSuggestedOrderQty(targetStock, product.current_stock);
      const status = calcStatus(product.current_stock, rop);
      const trendWarning = calcTrendWarning(add3, add7);

      return {
        ...product,
        add7,
        add3,
        rop,
        stockCoverageDays,
        targetStock,
        suggestedOrderQty,
        status,
        trendWarning,
      };
    });

    // Sort: Reorder now (0) → Watch (1) → Healthy (2), then alphabetical by name
    dashboardItems.sort((a, b) => {
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name);
    });

    return res.json(dashboardItems);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
