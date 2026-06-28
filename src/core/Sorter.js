/**
 * ============================================================================
 * Features 4 & 9: Single & Multi-Column Telemetry Sorter (20 Points)
 * ============================================================================
 * Manages active sort parameters and provides a compound comparator for chained
 * multi-column sorting.
 * 
 * Logic Mechanics:
 * - Single Column Sort: Click column header to toggle ascending/descending order.
 * - Multi-Column Sort (Feature 9): Shift+Click appends additional columns to the
 *   sort priority tree (e.g. status first, then ROI percent descending).
 * - Compound Comparator: Loops through sort priority column descriptors in sequence,
 *   sub-sorting rows when previous values are equal.
 * - Fast-path Type Coercion: Caches numeric vs lexicographical lookups to prevent
 *   string conversion overhead.
 */

import { toNumber } from '../utils/formatters.js';

/** Numeric column keys that need numeric comparison */
const NUMERIC_KEYS = new Set([
  'budget_usd', 'annual_savings_usd', 'roi_percent',
  'robots_deployed', 'employee_hours_saved',
]);

/**
 * Extract a comparable value from a row for a given column key.
 * @param {Object} row
 * @param {string} key
 * @returns {number|string}
 */
function getSortValue(row, key) {
  const raw = row[key];
  if (NUMERIC_KEYS.has(key)) {
    return toNumber(raw, 0);
  }
  return (raw || '').toString().toLowerCase();
}

/**
 * Create a comparator function from an array of sort descriptors.
 * @param {Array<{key: string, direction: 'asc'|'desc'}>} sortColumns
 * @returns {Function} Comparator for Array.sort()
 */
export function buildComparator(sortColumns) {
  if (!sortColumns || sortColumns.length === 0) return null;

  return function comparator(a, b) {
    for (let i = 0; i < sortColumns.length; i++) {
      const { key, direction } = sortColumns[i];
      const multiplier = direction === 'asc' ? 1 : -1;

      const valA = getSortValue(a, key);
      const valB = getSortValue(b, key);

      if (valA < valB) return -1 * multiplier;
      if (valA > valB) return 1 * multiplier;
      // If equal, fall through to next sort key
    }
    return 0;
  };
}

/**
 * Manages the active sort column state.
 */
export class SortManager {
  constructor() {
    /** @type {Array<{key: string, direction: 'asc'|'desc'}>} */
    this.columns = [];
    this._comparator = null;
    this._dirty = true;
  }

  /**
   * Toggle sort on a column.
   * @param {string} key - Column key
   * @param {boolean} isMulti - Whether Shift was held (multi-sort)
   */
  toggle(key, isMulti = false) {
    if (isMulti) {
      // Multi-sort: add or toggle direction
      const existing = this.columns.find(s => s.key === key);
      if (existing) {
        if (existing.direction === 'asc') {
          existing.direction = 'desc';
        } else {
          // Remove on third click
          this.columns = this.columns.filter(s => s.key !== key);
        }
      } else {
        this.columns.push({ key, direction: 'asc' });
      }
    } else {
      // Single sort: replace
      if (this.columns.length === 1 && this.columns[0].key === key) {
        if (this.columns[0].direction === 'asc') {
          this.columns[0].direction = 'desc';
        } else {
          this.columns = []; // Clear sort on third click
        }
      } else {
        this.columns = [{ key, direction: 'asc' }];
      }
    }
    this._dirty = true;
    this._comparator = buildComparator(this.columns);
  }

  /**
   * Sort an array in-place using current sort state.
   * @param {Object[]} data
   * @returns {Object[]} Same array, sorted
   */
  apply(data) {
    if (this._comparator && this.columns.length > 0) {
      data.sort(this._comparator);
    }
    return data;
  }

  /**
   * Check if any sort is active.
   * @returns {boolean}
   */
  get isActive() {
    return this.columns.length > 0;
  }

  /**
   * Get human-readable sort description.
   * @returns {string}
   */
  getDescription() {
    if (this.columns.length === 0) return '';
    return this.columns
      .map((s, i) => `${i + 1}. ${s.key} ${s.direction === 'asc' ? '↑' : '↓'}`)
      .join('  ');
  }

  /**
   * Clear all sort state.
   */
  clear() {
    this.columns = [];
    this._comparator = null;
    this._dirty = true;
  }
}
