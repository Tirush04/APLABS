/**
 * Linear interpolation percentile matching Excel's PERCENTILE.INC (and R type 7).
 * For p in [0, 1] and sorted array of length N:
 * index = p * (N - 1)
 * i = floor(index), f = index - i
 * value = sorted[i] + f * (sorted[i + 1] - sorted[i])
 */
export function percentileInc(arr: number[], p: number): number {
  if (!arr || arr.length === 0) return 0;
  if (arr.length === 1) return arr[0];
  if (p <= 0) return Math.min(...arr);
  if (p >= 1) return Math.max(...arr);

  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  const k = p * (n - 1);
  const i = Math.floor(k);
  const f = k - i;

  if (i >= n - 1) {
    return sorted[n - 1];
  }

  return sorted[i] + f * (sorted[i + 1] - sorted[i]);
}

export function median(arr: number[]): number {
  return percentileInc(arr, 0.5);
}

export function parsePrice(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatCurrency(amount: number, decimals: number = 0): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatPercent(decimal: number, decimals: number = 1): string {
  if (isNaN(decimal) || decimal === null || decimal === undefined) return '0%';
  return `${(decimal * 100).toFixed(decimals)}%`;
}

export function formatNumber(num: number, decimals: number = 0): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
