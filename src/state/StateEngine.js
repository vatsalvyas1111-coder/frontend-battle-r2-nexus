/**
 * ============================================================================
 * Central State Engine & Telemetry Pipeline
 * ============================================================================
 * The state orchestration core of the RPA Telemetry Dashboard.
 * 
 * Implemented Features:
 * - Feature 1: High-Density KPIs Dashboard (calculated accurately from unique project maps)
 * - Feature 5: The Pipeline Buffer Control (pauses grid ingestion & freezes KPIs, flushes on resume)
 * - requestAnimationFrame (rAF) Batching: Gathers multiple updates per tick and restricts
 *   layout calculation rate to maximum 1 per frame to maintain high FPS and prevent layout thrashing.
 * - Map-based O(1) Lookups: Keeps a Map of internal_uid -> row for fast update hot-paths.
 */

import { SortManager } from '../core/Sorter.js';
import { compileSearchTokens, matchRow } from '../core/FuzzySearch.js';
import { toNumber } from '../utils/formatters.js';

export class StateEngine {
  constructor() {
    // ── Core Data Store ──
    this.dataMap = new Map();        // internal_uid → parsed row
    this.allRows = [];               // Snapshot array of all rows

    // ── Derived Views ──
    this.filteredRows = [];          // After filters + search
    this.sortedView = [];            // After sorting (fed to grid)

    // ── KPI Accumulators (monotonically increasing) ──
    this.kpis = {
      totalRowsProcessed: 0,
      totalRobots: 0,
      totalSavings: 0,
    };

    // ── Sort Engine ──
    this.sortManager = new SortManager();

    // ── Filter State ──
    this.activeFilters = {};         // { field: selectedValue }

    // ── Search State ──
    this.searchQuery = '';
    this._searchTokens = [];

    // ── Pause / Play ──
    this.isPaused = false;
    this.pauseBuffer = [];

    // ── Live Update Tracking (for row flash) ──
    this.recentlyUpdated = new Set();
    this.lastBatchSize = 0;

    // ── Filter Options (auto-collected from data) ──
    this.filterOptions = {
      automation_type: new Set(),
      department: new Set(),
      industry: new Set(),
    };

    // ── Alert Tracking ──
    this.alertUids = new Map();      // uid → timestamp

    // ── Event System ──
    this._listeners = {};

    // ── rAF Batching ──
    this._pendingRaf = null;

    // ── Stats ──
    this._tickCount = 0;
    this._lastTickTime = 0;
  }

  // ═══════════════ EVENT SYSTEM ═══════════════

  /**
   * Subscribe to an event.
   * Events: 'kpi', 'data', 'filter-options', 'pause', 'pause-update', 'sort', 'status'
   */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  /** Emit an event to all subscribers */
  _emit(event, data) {
    const list = this._listeners[event];
    if (list) {
      for (let i = 0; i < list.length; i++) {
        list[i](data);
      }
    }
  }

  // ═══════════════ STREAM PROCESSING ═══════════════

  /**
   * Main entry point — called by dataStream.js callback every 200ms.
   * @param {Object[]} incomingBatch
   */
  process(incomingBatch) {
    if (this.isPaused) {
      // Queue data but do not update grid or KPIs
      for (let i = 0; i < incomingBatch.length; i++) {
        this.pauseBuffer.push(incomingBatch[i]);
      }
      this._emit('pause-update', { buffered: this.pauseBuffer.length });
      return;
    }

    this._tickCount++;
    this._lastTickTime = performance.now();

    this.kpis.totalRowsProcessed += incomingBatch.length;
    this._ingestBatch(incomingBatch);
    this._emit('tick', { batchSize: incomingBatch.length, tickCount: this._tickCount });
  }

  /**
   * Ingest a batch into the data store and schedule recompute.
   * @param {Object[]} batch
   */
  _ingestBatch(batch) {
    this.recentlyUpdated = new Set(); // fresh set for this tick
    this.lastBatchSize = batch.length;

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const parsed = this._parseRow(row);

      this.dataMap.set(parsed.internal_uid, parsed);
      this.recentlyUpdated.add(parsed.internal_uid); // track for row flash

      // Collect filter options
      if (parsed.automation_type) this.filterOptions.automation_type.add(parsed.automation_type);
      if (parsed.department) this.filterOptions.department.add(parsed.department);
      if (parsed.industry) this.filterOptions.industry.add(parsed.industry);

      // Check for alert conditions (Feature 3)
      if (parsed.project_status === 'Failed' || parsed._roi < 0) {
        this.alertUids.set(parsed.internal_uid, Date.now());
      }
    }

    this._scheduleRecompute();
  }

  /**
   * Parse raw row from dataStream into typed fields.
   * Adds underscore-prefixed numeric versions for sorting/comparison.
   */
  _parseRow(row) {
    return {
      ...row,
      _searchable: [
        row.project_id,
        row.company_id,
        row.project_name,
        row.project_status,
        row.automation_type,
        row.department,
        row.implementation_partner,
        row.country,
        row.industry,
        row.ai_enabled,
        row.cloud_deployment,
      ].filter(Boolean).join(' ').toLowerCase(),
      _budget: toNumber(row.budget_usd),
      _savings: toNumber(row.annual_savings_usd),
      _roi: toNumber(row.roi_percent),
      _robots: parseInt(row.robots_deployed, 10) || 0,
      _hours: parseInt(row.employee_hours_saved, 10) || 0,
    };
  }

  // ═══════════════ RECOMPUTE PIPELINE ═══════════════

  /** Schedule a recompute on the next animation frame (max 1 per frame) */
  _scheduleRecompute() {
    if (this._pendingRaf !== null) return;
    this._pendingRaf = requestAnimationFrame(() => {
      this._recompute();
      this._pendingRaf = null;
    });
  }

  /** Full pipeline: filter → search → sort → emit */
  _recompute() {
    // 1. Build array from map
    this.allRows = Array.from(this.dataMap.values());

    // ── Calculate accurate live KPIs dynamically based on unique projects in dataMap ──
    let robotsSum = 0;
    for (let i = 0; i < this.allRows.length; i++) {
      robotsSum += this.allRows[i]._robots;
    }
    this.kpis.totalRobots = robotsSum;

    // 2. Apply categorical filters
    let result = this.allRows;
    const filterEntries = Object.entries(this.activeFilters);
    if (filterEntries.length > 0) {
      result = result.filter(row => {
        for (let i = 0; i < filterEntries.length; i++) {
          const [field, value] = filterEntries[i];
          if (value && value !== '' && row[field] !== value) return false;
        }
        return true;
      });
    }

    // 3. Apply fuzzy search
    if (this._searchTokens.length > 0) {
      result = result.filter(row => matchRow(row, this._searchTokens));
    }

    this.filteredRows = result;

    // Sum savings only for the filtered rows currently in the view
    let savingsSum = 0;
    for (let i = 0; i < this.filteredRows.length; i++) {
      savingsSum += this.filteredRows[i]._savings;
    }
    this.kpis.totalSavings = savingsSum;

    // 4. Apply sort (only if sort is active)
    if (this.sortManager.isActive) {
      // Clone before sort to avoid mutating filteredRows reference
      this.sortedView = [...this.filteredRows];
      this.sortManager.apply(this.sortedView);
    } else {
      this.sortedView = this.filteredRows;
    }

    // 5. Clean expired alerts (> 2s old)
    const now = Date.now();
    if (this.alertUids.size > 0) {
      for (const [uid, timestamp] of this.alertUids) {
        if (now - timestamp > 2000) this.alertUids.delete(uid);
      }
    }

    // 6. Emit updates
    this._emit('kpi', this.kpis);
    this._emit('data', this.sortedView);
    this._emit('filter-options', this.filterOptions);
    this._emit('sort', this.sortManager.columns);
  }

  // ═══════════════ SORT CONTROLS (Features 4 & 9) ═══════════════

  /**
   * Toggle sort on a column.
   * @param {string} column
   * @param {boolean} isShiftKey - Multi-sort if true
   */
  toggleSort(column, isShiftKey = false) {
    this.sortManager.toggle(column, isShiftKey);
    this._scheduleRecompute();
  }

  // ═══════════════ FILTER CONTROLS (Feature 7) ═══════════════

  /**
   * Set a categorical filter.
   * @param {string} field
   * @param {string} value - Empty string or '' to clear
   */
  setFilter(field, value) {
    if (!value || value === '') {
      delete this.activeFilters[field];
    } else {
      this.activeFilters[field] = value;
    }
    this._scheduleRecompute();
  }

  // ═══════════════ SEARCH CONTROLS (Feature 10) ═══════════════

  /**
   * Set the search query. Debounce externally.
   * @param {string} query
   */
  setSearch(query) {
    this.searchQuery = query;
    this._searchTokens = compileSearchTokens(query);
    this._scheduleRecompute();
  }

  // ═══════════════ PAUSE / PLAY (Feature 5) ═══════════════

  /**
   * Toggle pause state.
   * On resume: flushes the entire pause buffer.
   * @returns {boolean} New pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;

    if (this.isPaused && this._pendingRaf !== null) {
      cancelAnimationFrame(this._pendingRaf);
      this._pendingRaf = null;
    }

    if (!this.isPaused && this.pauseBuffer.length > 0) {
      // Flush buffered data, add to processed rows count and ingest
      this.kpis.totalRowsProcessed += this.pauseBuffer.length;
      this._ingestBatch(this.pauseBuffer);
      this.pauseBuffer = [];
    } else if (!this.isPaused) {
      this._scheduleRecompute();
    }

    this._emit('pause', { isPaused: this.isPaused });
    return this.isPaused;
  }

  // ═══════════════ ALERT QUERIES ═══════════════

  /**
   * Check if a row should show alert styling.
   * @param {string} uid
   * @returns {boolean}
   */
  isRowAlert(uid) {
    return this.alertUids.has(uid);
  }

  // ═══════════════ STATS ═══════════════

  get uniqueRowCount() {
    return this.dataMap.size;
  }

  get viewRowCount() {
    return this.sortedView.length;
  }

  get tickCount() {
    return this._tickCount;
  }
}
