import { useEffect, useState, useCallback } from 'react';
import { getProducts, getSalesForDate, recordSale } from '../api/client';
import type { Product, SalesRecord, ApiError } from '../types';

/** Returns today's date as YYYY-MM-DD in LOCAL time (not UTC). */
function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface RowState {
  product: Product;
  /** Loaded from the API for the selected date; null = no record yet */
  savedQty: number | null;
  /** Editable input value */
  inputQty: string;
  saving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
}

export default function DailySalesPage() {
  const [selectedDate, setSelectedDate] = useState(localToday());
  const [rows, setRows]             = useState<RowState[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);

  const today = localToday();

  /** Load products once, then load sales for the selected date. */
  const load = useCallback(async (date: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      // Always reload products so current_stock is fresh
      const products = await getProducts();
      if (products.length === 0) {
        setRows([]);
        return;
      }

      // Fetch sales for each product on the selected date in parallel
      const salesResults = await Promise.allSettled(
        products.map((p) => getSalesForDate(p.id, date))
      );

      setRows(
        products.map((product, i) => {
          const result = salesResults[i];
          const records: SalesRecord[] =
            result.status === 'fulfilled' ? result.value : [];
          const existing = records.find((r) => r.sale_date === date);
          const savedQty = existing ? existing.units_sold : null;
          return {
            product,
            savedQty,
            inputQty: savedQty !== null ? String(savedQty) : '',
            saving: false,
            saveError: null,
            saveSuccess: false,
          };
        })
      );
    } catch (err) {
      setLoadError((err as ApiError).message ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedDate); }, [selectedDate, load]);

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedDate(e.target.value);
  }

  function handleInputChange(productId: number, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.product.id === productId
          ? { ...r, inputQty: value, saveError: null, saveSuccess: false }
          : r
      )
    );
  }

  async function handleSave(productId: number) {
    const row = rows.find((r) => r.product.id === productId);
    if (!row) return;

    const parsed = parseInt(row.inputQty, 10);
    if (
      row.inputQty.trim() === '' ||
      !Number.isInteger(parsed) ||
      parsed < 0 ||
      String(parsed) !== row.inputQty.trim()
    ) {
      setRows((prev) =>
        prev.map((r) =>
          r.product.id === productId
            ? { ...r, saveError: 'Enter a non-negative whole number.' }
            : r
        )
      );
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.product.id === productId
          ? { ...r, saving: true, saveError: null, saveSuccess: false }
          : r
      )
    );

    try {
      const result = await recordSale(productId, {
        sale_date: selectedDate,
        units_sold: parsed,
      });
      const newStock = (result.product as Product).current_stock;
      const newSaved = (result.salesRecord as SalesRecord).units_sold;
      setRows((prev) =>
        prev.map((r) =>
          r.product.id === productId
            ? {
                ...r,
                saving: false,
                saveSuccess: true,
                saveError: null,
                savedQty: newSaved,
                inputQty: String(newSaved),
                product: { ...r.product, current_stock: newStock },
              }
            : r
        )
      );
    } catch (err) {
      const msg = (err as ApiError).message ?? 'Save failed.';
      setRows((prev) =>
        prev.map((r) =>
          r.product.id === productId
            ? { ...r, saving: false, saveError: msg }
            : r
        )
      );
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Daily Sales</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label htmlFor="sales-date" style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            Date
          </label>
          <input
            id="sales-date"
            type="date"
            value={selectedDate}
            max={today}
            onChange={handleDateChange}
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              color: 'var(--color-text)',
              padding: '6px 10px',
              fontSize: 14,
            }}
          />
        </div>
      </div>

      {loading && (
        <div className="state-container">
          <div className="spinner" role="status" aria-label="Loading" />
          <div className="state-text">Loading sales for {selectedDate}…</div>
        </div>
      )}

      {!loading && loadError && (
        <div className="state-container">
          <div className="state-icon">⚠</div>
          <div className="state-text" role="alert">{loadError}</div>
          <button className="btn btn-secondary" onClick={() => load(selectedDate)}>
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <div className="state-container">
          <div className="state-icon">📦</div>
          <div className="state-text">No products found. Add a product first.</div>
        </div>
      )}

      {!loading && !loadError && rows.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Current Stock</th>
                <th scope="col">Sold on {selectedDate}</th>
                <th scope="col" style={{ width: 160 }}>Update Total Sold</th>
                <th scope="col" style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.product.id}>
                  <td>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-strong)' }}>
                      {row.product.name}
                    </span>
                    {row.product.is_sample === 1 && (
                      <span className="sample-tag" style={{ marginLeft: 6 }}>Sample</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{row.product.current_stock}</td>
                  <td style={{ color: 'var(--color-muted)' }}>
                    {row.savedQty !== null ? row.savedQty : <em style={{ opacity: 0.5 }}>—</em>}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.inputQty}
                      onChange={(e) => handleInputChange(row.product.id, e.target.value)}
                      disabled={row.saving}
                      placeholder="0"
                      aria-label={`Total sold for ${row.product.name} on ${selectedDate}`}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 8px',
                        fontSize: 14,
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        border: `1px solid ${row.saveError ? 'var(--color-danger)' : 'var(--color-border)'}`,
                        borderRadius: 6,
                        outline: 'none',
                      }}
                    />
                    {row.saveError && (
                      <div
                        role="alert"
                        style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}
                      >
                        {row.saveError}
                      </div>
                    )}
                  </td>
                  <td>
                    {row.saveSuccess ? (
                      <span style={{ color: 'var(--color-success)', fontSize: 13, fontWeight: 600 }}>
                        ✓ Saved
                      </span>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}
                        onClick={() => handleSave(row.product.id)}
                        disabled={row.saving || row.inputQty.trim() === ''}
                        aria-busy={row.saving}
                      >
                        {row.saving ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
