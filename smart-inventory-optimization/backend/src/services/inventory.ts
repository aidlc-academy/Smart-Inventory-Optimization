/**
 * Pure formula functions for inventory calculations.
 * No database or network calls — all inputs are passed as arguments.
 * These are the authoritative implementations matching calculation-rules.md and design.md §4.
 */

/**
 * Calculate Average Daily Demand over a 7-day window.
 * Formula: ADD_7 = totalUnitsInWindow / 7
 * Division is always by 7 even if fewer than 7 days have data.
 * If no sales in window, returns 0.
 *
 * @param totalUnitsInWindow - Sum of units_sold for all records in the 7-day window
 */
export function calcADD7(totalUnitsInWindow: number): number {
  return totalUnitsInWindow / 7;
}

/**
 * Calculate Average Daily Demand over a 3-day window.
 * Formula: ADD_3 = totalUnitsInWindow / 3
 * Division is always by 3 even if fewer than 3 days have data.
 * If no sales in window, returns 0.
 *
 * @param totalUnitsInWindow - Sum of units_sold for all records in the 3-day window
 */
export function calcADD3(totalUnitsInWindow: number): number {
  return totalUnitsInWindow / 3;
}

/**
 * Calculate the Reorder Point.
 * Formula: ROP = ceil(ADD_7 × supplierLeadTimeDays + safetyStock)
 * Special case: if ADD_7 = 0, ROP = safetyStock (lead-time buffer collapses to zero).
 *
 * @param add7 - Average daily demand over 7 days
 * @param leadTimeDays - Supplier lead time in days (user-set assumption)
 * @param safetyStock - Minimum buffer stock (user-set assumption)
 */
export function calcROP(add7: number, leadTimeDays: number, safetyStock: number): number {
  return Math.ceil(add7 * leadTimeDays + safetyStock);
}

/**
 * Calculate stock coverage in days.
 * Formula: stock_coverage_days = currentStock / ADD_7
 * Returns null when ADD_7 === 0 to signal "No recent sales" (never divide by zero).
 *
 * @param currentStock - Current units in stock
 * @param add7 - Average daily demand over 7 days
 */
export function calcStockCoverage(currentStock: number, add7: number): number | null {
  if (add7 === 0) return null;
  return currentStock / add7;
}

/**
 * Calculate the suggested target stock level.
 * Formula: target_stock = ADD_7 × (supplierLeadTimeDays + targetCoverageDays) + safetyStock
 *
 * @param add7 - Average daily demand over 7 days
 * @param leadTimeDays - Supplier lead time in days
 * @param targetCoverageDays - Desired days of forward coverage (user-set assumption)
 * @param safetyStock - Minimum buffer stock (user-set assumption)
 */
export function calcTargetStock(
  add7: number,
  leadTimeDays: number,
  targetCoverageDays: number,
  safetyStock: number
): number {
  return add7 * (leadTimeDays + targetCoverageDays) + safetyStock;
}

/**
 * Calculate the suggested order quantity.
 * Formula: suggested_order_qty = max(0, ceil(targetStock) - currentStock)
 * Always returns a non-negative integer.
 *
 * @param targetStock - Suggested target stock level (from calcTargetStock)
 * @param currentStock - Current units in stock
 */
export function calcSuggestedOrderQty(targetStock: number, currentStock: number): number {
  return Math.max(0, Math.ceil(targetStock) - currentStock);
}

/**
 * Classify product status based on current stock vs reorder point.
 * - "Reorder now": currentStock <= ROP
 * - "Watch": currentStock > ROP AND currentStock <= ROP × 1.25
 * - "Healthy": currentStock > ROP × 1.25
 *
 * @param currentStock - Current units in stock
 * @param rop - Reorder point (from calcROP)
 */
export function calcStatus(
  currentStock: number,
  rop: number
): 'Reorder now' | 'Watch' | 'Healthy' {
  if (currentStock <= rop) return 'Reorder now';
  if (currentStock <= rop * 1.25) return 'Watch';
  return 'Healthy';
}

/**
 * Determine if there is a trending sales increase warning.
 * Formula: trendWarning = ADD_3 > ADD_7 × 1.20
 * (3-day average is more than 20% above the 7-day average)
 * This is a formula-based indicator, not a prediction.
 *
 * @param add3 - Average daily demand over 3 days
 * @param add7 - Average daily demand over 7 days
 */
export function calcTrendWarning(add3: number, add7: number): boolean {
  return add3 > add7 * 1.20;
}
