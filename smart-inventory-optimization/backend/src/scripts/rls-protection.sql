BEGIN;

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.owners,
  public.shops,
  public.products,
  public.sales_records,
  public.stock_movements,
  public.purchase_orders
FROM PUBLIC, anon, authenticated;

COMMIT;
