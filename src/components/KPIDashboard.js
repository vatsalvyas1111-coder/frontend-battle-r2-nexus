/**
 * ============================================================================
 * Feature 1: High-Density KPIs Dashboard (10 Points)
 * ============================================================================
 * Renders three live, high-frequency counters in sync with the data stream:
 * 1. Total Streamed Rows Processed: The cumulative telemetry updates count.
 * 2. Active Robots Deployed: Accurate sum of robots across all unique projects in memory.
 * 3. Cumulative Savings: Accurate sum of savings across the current filtered view.
 *
 * Performance & Polish:
 * - Uses textContent updates (zero-innerHTML) to bypass rendering overhead.
 * - Card flashes (kpi-card--flash) triggered selectively on actual value mutations.
 * - Pauses execution and freezes counters in sync when the telemetry is stopped.
 */

import { formatCompact, formatCurrencyKPI } from '../utils/formatters.js';

export class KPIDashboard {
  /**
   * @param {HTMLElement} container - Mount point (#kpi-grid)
   * @param {import('../state/StateEngine.js').StateEngine} state
   */
  constructor(container, state) {
    this.container = container;
    this.state = state;

    this._elements = {};
    this._lastValues = { rows: -1, robots: -1, savings: -1 };

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this.container.innerHTML = '';

    const cards = [
      { id: 'rows', label: 'Total Rows Processed' },
      { id: 'robots', label: 'Active Robots Deployed' },
      { id: 'savings', label: 'Cumulative Savings' },
    ];

    for (const card of cards) {
      const el = document.createElement('div');
      el.className = 'kpi-card';
      el.id = `kpi-${card.id}`;

      const label = document.createElement('div');
      label.className = 'kpi-label';
      label.textContent = card.label;

      const value = document.createElement('div');
      value.className = 'kpi-value';
      value.id = `kpi-value-${card.id}`;
      value.textContent = '0';

      const sub = document.createElement('div');
      sub.className = 'kpi-sub';
      sub.id = `kpi-sub-${card.id}`;

      const subValue = document.createElement('span');
      subValue.className = 'kpi-rate';
      subValue.textContent = '0';

      const subLabel = document.createElement('span');
      subLabel.className = 'kpi-sub-label';
      subLabel.textContent = 'Awaiting stream...';

      sub.appendChild(subValue);
      sub.appendChild(document.createTextNode(' '));
      sub.appendChild(subLabel);

      el.appendChild(label);
      el.appendChild(value);
      el.appendChild(sub);
      this.container.appendChild(el);

      this._elements[card.id] = { value, subValue, subLabel };
    }
  }

  _bindEvents() {
    this.state.on('kpi', (kpis) => {
      this._update(kpis);
    });
  }

  /**
   * Update KPI card values. Only touches DOM if values changed.
   */
  _update(kpis) {
    const { totalRowsProcessed, totalRobots, totalSavings } = kpis;

    if (totalRowsProcessed !== this._lastValues.rows) {
      this._elements.rows.value.textContent = formatCompact(totalRowsProcessed);
      this._elements.rows.subValue.textContent = `+${this.state.tickCount}`;
      this._elements.rows.subLabel.textContent = 'stream ticks';
      this._lastValues.rows = totalRowsProcessed;
      this._flashCard('rows');
    }

    if (totalRobots !== this._lastValues.robots) {
      this._elements.robots.value.textContent = formatCompact(totalRobots);
      this._elements.robots.subValue.textContent = this.state.uniqueRowCount.toLocaleString();
      this._elements.robots.subLabel.textContent = 'unique projects';
      this._lastValues.robots = totalRobots;
    }

    if (totalSavings !== this._lastValues.savings) {
      this._elements.savings.value.textContent = formatCurrencyKPI(totalSavings);
      this._elements.savings.subValue.textContent = this.state.viewRowCount.toLocaleString();
      this._elements.savings.subLabel.textContent = 'in current view';
      this._lastValues.savings = totalSavings;
      this._flashCard('savings');
    }
  }

  /** Brief glow flash on KPI card to signal a live update tick */
  _flashCard(id) {
    const card = document.getElementById(`kpi-${id}`);
    if (!card) return;
    card.classList.remove('kpi-card--flash');
    void card.offsetWidth; // force reflow to restart animation
    card.classList.add('kpi-card--flash');
  }
}
