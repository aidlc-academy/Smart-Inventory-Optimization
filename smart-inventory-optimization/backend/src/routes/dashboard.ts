import { Router, Request, Response } from 'express';
import { query } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { requireShop, ShopRequest } from '../middleware/shopContext';
import { calcADD7, calcADD3, calcROP, calcStockCoverage, calcTargetStock, calcSuggestedOrderQty, calcStatus, calcTrendWarning } from '../services/inventory';

const router = Router();
router.use(requireAuth as any, requireShop as any);

const sr = (req: Request): ShopRequest => req as unknown as ShopRequest;

function dateDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { shopId } = sr(req).shop;
    const products = await query<{
      id: number; name: string; sku: string; current_stock: number;
      supplier_lead_time_days: number; safety_stock: number; target_coverage_days: number;
      is_sample: number; created_at: string; updated_at: string;
    }>('SELECT * FROM products WHERE shop_id=$1 ORDER BY name ASC', [shopId]);

    const statusPriority = { 'Reorder now': 0, Watch: 1, Healthy: 2 };
    const add7Date = dateDaysAgo(6);
    const add3Date = dateDaysAgo(2);

    const dashboardItems = await Promise.all(products.map(async (product) => {
      const add7Row = await query<{ total: string }>(
        `SELECT COALESCE(SUM(units_sold),0) as total FROM sales_records WHERE product_id=$1 AND shop_id=$2 AND sale_date>=$3`,
        [product.id, shopId, add7Date]
      );
      const add3Row = await query<{ total: string }>(
        `SELECT COALESCE(SUM(units_sold),0) as total FROM sales_records WHERE product_id=$1 AND shop_id=$2 AND sale_date>=$3`,
        [product.id, shopId, add3Date]
      );
      const add7 = calcADD7(Number(add7Row[0]?.total ?? 0));
      const add3 = calcADD3(Number(add3Row[0]?.total ?? 0));
      const rop  = calcROP(add7, product.supplier_lead_time_days, product.safety_stock);
      const targetStock = calcTargetStock(add7, product.supplier_lead_time_days, product.target_coverage_days, product.safety_stock);
      return {
        ...product,
        add7, add3, rop,
        stockCoverageDays:  calcStockCoverage(product.current_stock, add7),
        targetStock,
        suggestedOrderQty:  calcSuggestedOrderQty(targetStock, product.current_stock),
        status:             calcStatus(product.current_stock, rop),
        trendWarning:       calcTrendWarning(add3, add7),
      };
    }));

    dashboardItems.sort((a, b) => {
      const pd = statusPriority[a.status] - statusPriority[b.status];
      return pd !== 0 ? pd : a.name.localeCompare(b.name);
    });

    return res.json(dashboardItems);
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
