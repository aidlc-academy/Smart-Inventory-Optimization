import { describe, it, expect } from 'vitest';
import {
  calcADD7,
  calcADD3,
  calcROP,
  calcStockCoverage,
  calcTargetStock,
  calcSuggestedOrderQty,
  calcStatus,
  calcTrendWarning,
} from './inventory';

describe('calcADD7', () => {
  it('returns total / 7 for a normal week', () => {
    expect(calcADD7(21)).toBe(3.0);
  });

  it('returns 0 for zero units', () => {
    expect(calcADD7(0)).toBe(0);
  });

  it('still divides by 7 even for a partial week', () => {
    // 3 days of data with 9 total units → 9/7
    expect(calcADD7(9)).toBeCloseTo(9 / 7);
  });

  it('handles large numbers', () => {
    expect(calcADD7(700)).toBe(100);
  });
});

describe('calcADD3', () => {
  it('returns total / 3 for a normal 3-day window', () => {
    expect(calcADD3(12)).toBe(4.0);
  });

  it('returns 0 for zero units', () => {
    expect(calcADD3(0)).toBe(0);
  });

  it('handles single day data', () => {
    expect(calcADD3(6)).toBe(2.0);
  });
});

describe('calcROP', () => {
  it('calculates correctly for normal inputs', () => {
    // ceil(5 * 5 + 5) = ceil(30) = 30
    expect(calcROP(5, 5, 5)).toBe(30);
  });

  it('returns safety_stock when add7 = 0', () => {
    expect(calcROP(0, 5, 10)).toBe(10);
  });

  it('returns 0 when add7 = 0 and safety_stock = 0', () => {
    expect(calcROP(0, 5, 0)).toBe(0);
  });

  it('rounds up (ceil) fractional results', () => {
    // ceil(1.5 * 3 + 0) = ceil(4.5) = 5
    expect(calcROP(1.5, 3, 0)).toBe(5);
  });

  it('uses only safety stock when lead time is 0', () => {
    expect(calcROP(5, 0, 8)).toBe(8);
  });
});

describe('calcStockCoverage', () => {
  it('calculates days of coverage correctly', () => {
    expect(calcStockCoverage(30, 5)).toBe(6.0);
  });

  it('returns null when add7 is 0 (no recent sales)', () => {
    expect(calcStockCoverage(100, 0)).toBeNull();
  });

  it('returns 0 when current stock is 0', () => {
    expect(calcStockCoverage(0, 5)).toBe(0);
  });
});

describe('calcTargetStock', () => {
  it('calculates target stock correctly', () => {
    // 5 * (5 + 14) + 5 = 5 * 19 + 5 = 100
    expect(calcTargetStock(5, 5, 14, 5)).toBe(100);
  });

  it('returns safety_stock when add7 is 0', () => {
    expect(calcTargetStock(0, 5, 14, 10)).toBe(10);
  });
});

describe('calcSuggestedOrderQty', () => {
  it('calculates the order quantity correctly', () => {
    // max(0, ceil(100) - 60) = 40
    expect(calcSuggestedOrderQty(100, 60)).toBe(40);
  });

  it('returns 0 when current stock meets target', () => {
    expect(calcSuggestedOrderQty(50, 60)).toBe(0);
  });

  it('returns 0 when current stock equals target exactly', () => {
    expect(calcSuggestedOrderQty(60, 60)).toBe(0);
  });

  it('never returns a negative number', () => {
    expect(calcSuggestedOrderQty(10, 100)).toBeGreaterThanOrEqual(0);
  });

  it('ceils fractional target stock', () => {
    // max(0, ceil(10.5) - 8) = max(0, 11 - 8) = 3
    expect(calcSuggestedOrderQty(10.5, 8)).toBe(3);
  });
});

describe('calcStatus', () => {
  it('returns "Reorder now" when stock is below ROP', () => {
    expect(calcStatus(10, 20)).toBe('Reorder now');
  });

  it('returns "Reorder now" when stock equals ROP', () => {
    expect(calcStatus(20, 20)).toBe('Reorder now');
  });

  it('returns "Watch" when stock is at ROP * 1.25', () => {
    // 20 * 1.25 = 25 → stock=25 should be Watch
    expect(calcStatus(25, 20)).toBe('Watch');
  });

  it('returns "Watch" when stock is between ROP and ROP * 1.25', () => {
    expect(calcStatus(22, 20)).toBe('Watch');
  });

  it('returns "Healthy" when stock is above ROP * 1.25', () => {
    expect(calcStatus(26, 20)).toBe('Healthy');
  });

  it('returns "Reorder now" when ROP is 0 and stock is 0', () => {
    expect(calcStatus(0, 0)).toBe('Reorder now');
  });

  it('returns "Healthy" when ROP is 0 and stock > 0', () => {
    // 0 * 1.25 = 0, stock=1 > 0 → Healthy
    expect(calcStatus(1, 0)).toBe('Healthy');
  });
});

describe('calcTrendWarning', () => {
  it('returns true when add3 is more than 20% above add7', () => {
    // add3 = add7 * 1.21 → true
    const add7 = 5;
    const add3 = add7 * 1.21;
    expect(calcTrendWarning(add3, add7)).toBe(true);
  });

  it('returns false when add3 equals add7', () => {
    expect(calcTrendWarning(5, 5)).toBe(false);
  });

  it('returns false when add3 is exactly 20% above add7', () => {
    // add3 = add7 * 1.20 → not strictly greater → false
    const add7 = 5;
    const add3 = add7 * 1.20;
    expect(calcTrendWarning(add3, add7)).toBe(false);
  });

  it('returns false when add3 is below add7', () => {
    expect(calcTrendWarning(3, 5)).toBe(false);
  });

  it('returns false when both are 0', () => {
    expect(calcTrendWarning(0, 0)).toBe(false);
  });
});
