import type { PoolClient } from 'pg';

function dateOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Seeds demo sample data scoped to the given shopId.
 * Removes any existing is_sample=1 products for this shop first (cascades).
 */
export async function seedDemoData(client: PoolClient, shopId: number): Promise<void> {
  const now = new Date().toISOString();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM products WHERE is_sample=1 AND shop_id=$1', [shopId]);

    const insertProduct = (name: string, sku: string, stock: number, lead: number, safety: number, coverage: number) =>
      client.query<{ id: number }>(
        `INSERT INTO products (name,sku,current_stock,supplier_lead_time_days,safety_stock,target_coverage_days,is_sample,created_at,updated_at,shop_id)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,$9) RETURNING id`,
        [name, sku, stock, lead, safety, coverage, now, now, shopId]
      );

    const coffeeId = (await insertProduct('Premium Coffee Blend 1kg', 'COFFEE-001', 18, 5, 5, 14)).rows[0].id;
    const flourId  = (await insertProduct('Standard Flour 5kg',       'FLOUR-005', 120, 3, 10, 14)).rows[0].id;
    const oilId    = (await insertProduct('Organic Olive Oil 500ml',  'OIL-500',   40, 7, 8,  14)).rows[0].id;

    const insertSale = async (productId: number, saleDate: string, unitsSold: number) => {
      await client.query(
        `INSERT INTO sales_records (product_id, sale_date, units_sold, created_at, shop_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (product_id, sale_date) DO UPDATE SET units_sold=EXCLUDED.units_sold, created_at=EXCLUDED.created_at`,
        [productId, saleDate, unitsSold, now, shopId]
      );
    };

    for (let d = -13; d <= -7; d++) await insertSale(coffeeId, dateOffset(d), 3);
    for (let d = -6;  d <= -4; d++) await insertSale(coffeeId, dateOffset(d), 3);
    for (let d = -3;  d <= 0;  d++) await insertSale(coffeeId, dateOffset(d), 6);
    for (let d = -13; d <= 0;  d++) await insertSale(flourId,  dateOffset(d), 8);
    for (let d = -13; d <= 0;  d++) await insertSale(oilId,    dateOffset(d), 2);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
