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
  test('normal: 21 units in window returns 3.0', () => {
    expect(calcADD7(21)).toBe(3.0);
  });

  test('zero units returns 0', () => {
    expect(calcADD7(0)).toBe(0);
  });

  test('partial week: 7 units still divides by 7', () => {
    expect(calcADD7(7)).toBe(1.0);
  });

  test('fractional result: 10 units / 7', () => {
    expect(calcADD7(10)).toBeCloseTo(10 / 7);
  });
});

describe('calcADD3', () => {
  test('normal: 12 units in window returns 4.0', () => {
    expect(calcADD3(12)).toBe(4.0);
  });

  test('zero units returns 0', () => {
    expect(calcADD3(0)).toBe(0);
  });

  test('fractional result: 7 units / 3', () => {
    expect(calcADD3(7)).toBeCloseTo(7 / 3);
  });
});

describe('calcROP', () => {
  test('normal: add7=5, lead=5, safety=5 → ceil(30)=30', () => {
    expect(calcROP(5, 5, 5)).toBe(30);
  });

  test('add7=0 → ROP equals safety_stock', () => {
    expect(calcROP(0, 5, 10)).toBe(10);
  });

  test('zero safety_stock: add7=3, lead=4, safety=0 → ceil(12)=12', () => {
    expect(calcROP(3, 4, 0)).toBe(12);
  });

  test('fractional result gets rounded up: add7=1.5, lead=3, safety=2 → ceil(6.5)=7', () => {
    expect(calcROP(1.5, 3, 2)).toBe(7);
  });

  test('add7=0 and safety=0 → ROP=0', () => {
    expect(calcROP(0, 5, 0)).toBe(0);
  });
});

describe('calcStockCoverage', () => {
  test('normal: stock=30, add7=5 → 6.0', () => {
    expect(calcStockCoverage(30, 5)).toBe(6.0);
  });

  test('add7=0 returns null (no recent sales)', () => {
    expect(calcStockCoverage(100, 0)).toBeNull();
  });

  test('zero stock with positive add7 returns 0', () => {
    expect(calcStockCoverage(0, 5)).toBe(0);
  });

  test('fractional coverage days', () => {
    expect(calcStockCoverage(10, 3)).toBeCloseTo(10 / 3);
  });
});

describe('calcTargetStock', () => {
  test('normal: add7=5, lead=5, coverage=14, safety=5 → 5*(5+14)+5 = 100', () => {
    expect(calcTargetStock(5, 5, 14, 5)).toBe(100);
  });

  test('add7=0 → target equals safetyStock', () => {
    expect(calcTargetStock(0, 5, 14, 10)).toBe(10);
  });
});

describe('calcSuggestedOrderQty', () => {
  test('normal: target=100, stock=60 → 40', () => {
    expect(calcSuggestedOrderQty(100, 60)).toBe(40);
  });

  test('stock >= target returns 0', () => {
    expect(calcSuggestedOrderQty(50, 60)).toBe(0);
  });

  test('stock equals target returns 0', () => {
    expect(calcSuggestedOrderQty(50, 50)).toBe(0);
  });

  test('never returns negative', () => {
    expect(calcSuggestedOrderQty(10, 100)).toBeGreaterThanOrEqual(0);
  });

  test('fractional target gets ceiled: target=10.3, stock=8 → ceil(10.3)-8=3', () => {
    expect(calcSuggestedOrderQty(10.3, 8)).toBe(3);
  });
});

describe('calcStatus', () => {
  test('stock below ROP → Reorder now', () => {
    expect(calcStatus(5, 10)).toBe('Reorder now');
  });

  test('stock equals ROP → Reorder now', () => {
    expect(calcStatus(10, 10)).toBe('Reorder now');
  });

  test('stock = ROP * 1.25 → Watch', () => {
    expect(calcStatus(12.5, 10)).toBe('Watch');
  });

  test('stock slightly above ROP but at Watch boundary', () => {
    expect(calcStatus(11, 10)).toBe('Watch');
  });

  test('stock above ROP * 1.25 → Healthy', () => {
    expect(calcStatus(13, 10)).toBe('Healthy');
  });

  test('ROP=0, stock=0 → Reorder now', () => {
    expect(calcStatus(0, 0)).toBe('Reorder now');
  });

  test('ROP=0, stock=1 → Healthy (0*1.25=0, stock>0)', () => {
    expect(calcStatus(1, 0)).toBe('Healthy');
  });
});

describe('calcTrendWarning', () => {
  test('add3 = add7 * 1.21 → true (exceeds 20% threshold)', () => {
    const add7 = 10;
    const add3 = add7 * 1.21;
    expect(calcTrendWarning(add3, add7)).toBe(true);
  });

  test('add3 equals add7 → false', () => {
    expect(calcTrendWarning(10, 10)).toBe(false);
  });

  test('add3 exactly 20% above add7 → false (must be strictly greater)', () => {
    const add7 = 10;
    const add3 = add7 * 1.20;
    expect(calcTrendWarning(add3, add7)).toBe(false);
  });

  test('add3 slightly less than add7 → false', () => {
    expect(calcTrendWarning(9, 10)).toBe(false);
  });

  test('add7=0 and add3=0 → false', () => {
    expect(calcTrendWarning(0, 0)).toBe(false);
  });

  test('add7=0 and add3>0 → true (any positive add3 > 0*1.20=0)', () => {
    expect(calcTrendWarning(1, 0)).toBe(true);
  });
});
