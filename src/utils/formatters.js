/**
 * ============================================================================
 * Financial & Numeric Formatting Utilities (Feature 2)
 * ============================================================================
 * Provides locale-aware currency, percentage, and integer formatting
 * using Intl.NumberFormat for maximum browser-native performance.
 */

// Pre-instantiate formatters (avoid creating on every call)
const currencyFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const currencyCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

const integerFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const integerCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

/**
 * Format a value as USD currency.
 * Uses compact notation for values >= 1M.
 * @param {string|number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '$0';
  if (Math.abs(num) >= 1_000_000) {
    return currencyCompact.format(num);
  }
  return currencyFull.format(num);
}

/**
 * Format a value as USD currency (always full precision).
 * @param {string|number} value
 * @returns {string}
 */
export function formatCurrencyFull(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '$0';
  return currencyFull.format(num);
}

/**
 * Format a percentage with strict 2 decimal places.
 * @param {string|number} value
 * @returns {string}
 */
export function formatPercent(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '0.00%';
  return num.toFixed(2) + '%';
}

/**
 * Format an integer with locale commas.
 * @param {string|number} value
 * @returns {string}
 */
export function formatInteger(value) {
  const num = typeof value === 'number' ? value : parseInt(value, 10);
  if (isNaN(num)) return '0';
  return integerFormat.format(num);
}

/**
 * Format large integers with compact notation for KPI cards.
 * @param {number} value
 * @returns {string}
 */
export function formatCompact(value) {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  if (Math.abs(value) >= 1_000_000) {
    return integerCompact.format(value);
  }
  return integerFormat.format(value);
}

/**
 * Format currency for KPI display (always compact).
 * @param {number} value
 * @returns {string}
 */
export function formatCurrencyKPI(value) {
  if (typeof value !== 'number' || isNaN(value)) return '$0';
  return currencyCompact.format(value);
}

/**
 * Safely parse a value to number.
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
export function toNumber(value, fallback = 0) {
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  const num = parseFloat(value);
  return isNaN(num) ? fallback : num;
}
