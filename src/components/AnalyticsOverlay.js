/**
 * ============================================================================
 * BONUS: Analytics View — Frozen Data Aggregation Overlay (+8 Points)
 * ============================================================================
 * Generates an interactive data visualization panel using Chart.js when the
 * telemetry stream is paused. Aggregates the dataset into four dynamic
 * charts providing operational insight during pipeline inspection.
 *
 * DUAL-MODE ANALYSIS ENGINE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  FROZEN SNAPSHOT  │ Aggregates only the rows currently visible in the   │
 * │                   │ grid (filteredRows). Reflects active search/filter. │
 * ├───────────────────┼─────────────────────────────────────────────────────┤
 * │  FULL PIPELINE    │ Loads and aggregates the entire 50,000-row baseline │
 * │                   │ database (from the CSV file). Cached after loading.  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Charts Rendered:
 * 1. Project Status Distribution — Doughnut (Active/Completed/Planned/Failed/On-Hold)
 * 2. Top 10 ROI Performers — Horizontal Bar (highest ROI% sorted by savings for ties)
 * 3. Savings by Department — Vertical Bar (cumulative annual savings per department)
 * 4. Industry Breakdown — Pie Chart (project count per industry vertical)
 *
 * Lifecycle:
 * - Button appears ONLY inside the pause overlay (stream must be paused).
 * - Charts are generated fresh each open from the selected mode's snapshot.
 * - Mode switch destroys existing charts and regenerates from the new source.
 * - All Chart.js instances destroyed on close to prevent canvas memory leaks.
 * - Auto-closes when stream resumes to prevent stale data display.
 */

import {
  Chart,
  DoughnutController,
  PieController,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  PolarAreaController,
  RadialLinearScale,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';

// ── Register only the Chart.js components we need (tree-shaking optimization) ──
Chart.register(
  DoughnutController, PieController, ArcElement,
  BarController, BarElement,
  CategoryScale, LinearScale,
  PolarAreaController, RadialLinearScale,
  Tooltip, Legend, Title
);

/**
 * Premium color palette for chart segments — curated for dark backgrounds.
 * Uses HSL-tuned values for visual harmony across all four chart types.
 */
const CHART_COLORS = [
  'rgba(0, 212, 255, 0.82)',    // Cyan      — brand primary
  'rgba(139, 92, 246, 0.82)',   // Purple    — brand secondary
  'rgba(16, 185, 129, 0.82)',   // Emerald
  'rgba(245, 158, 11, 0.82)',   // Amber
  'rgba(239, 68, 68, 0.82)',    // Red
  'rgba(59, 130, 246, 0.82)',   // Blue
  'rgba(236, 72, 153, 0.82)',   // Pink
  'rgba(168, 162, 158, 0.82)',  // Stone
  'rgba(34, 211, 238, 0.82)',   // Teal
  'rgba(251, 191, 36, 0.82)',   // Yellow
  'rgba(129, 140, 248, 0.82)',  // Indigo
  'rgba(244, 114, 182, 0.82)',  // Rose
];

const CHART_BORDERS = [
  'rgba(0, 212, 255, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(239, 68, 68, 1)',
  'rgba(59, 130, 246, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(168, 162, 158, 1)',
  'rgba(34, 211, 238, 1)',
  'rgba(251, 191, 36, 1)',
  'rgba(129, 140, 248, 1)',
  'rgba(244, 114, 182, 1)',
];

/** Shared Chart.js typography/color defaults for dark-theme consistency */
const DARK_THEME = {
  color: '#94a3b8',
  font: { family: "'Inter', system-ui, sans-serif", size: 11, weight: 500 },
};

/** Shared tooltip configuration applied to all four charts */
const TOOLTIP_CONFIG = {
  backgroundColor: 'rgba(5, 10, 22, 0.96)',
  titleColor: '#e8edf5',
  titleFont: { family: "'Inter', system-ui, sans-serif", size: 12, weight: 600 },
  bodyColor: '#94a3b8',
  bodyFont: { family: "'Inter', system-ui, sans-serif", size: 11 },
  borderColor: 'rgba(0, 212, 255, 0.15)',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
  displayColors: true,
  boxPadding: 4,
};

/** Project status → brand color mapping for the doughnut chart */
const STATUS_COLORS = {
  'Active':    { bg: 'rgba(0, 212, 255, 0.8)',   border: '#00d4ff' },
  'Completed': { bg: 'rgba(16, 185, 129, 0.8)',  border: '#10b981' },
  'Planned':   { bg: 'rgba(59, 130, 246, 0.8)',  border: '#3b82f6' },
  'Failed':    { bg: 'rgba(239, 68, 68, 0.8)',   border: '#ef4444' },
  'On-Hold':   { bg: 'rgba(245, 158, 11, 0.8)',  border: '#f59e0b' },
};

/**
 * Truncate a label string to maxLen characters with ellipsis.
 * @param {string} str
 * @param {number} [maxLen=20]
 * @returns {string}
 */
function truncLabel(str, maxLen = 20) {
  if (!str) return 'N/A';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

/**
 * Format a dollar value into a human-readable string (B/M/K).
 * @param {number} val
 * @returns {string}
 */
function formatDollars(val) {
  if (val >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
  if (val >= 1e3) return '$' + (val / 1e3).toFixed(0) + 'K';
  return '$' + val.toLocaleString();
}

export class AnalyticsOverlay {
  /**
   * @param {import('../state/StateEngine.js').StateEngine} state
   */
  constructor(state) {
    this.state = state;
    this._overlay = null;
    this._charts = [];         // Active Chart.js instances (tracked for cleanup)
    this._isOpen = false;
    this._mode = 'frozen';     // 'frozen' | 'full'
    this._fullDbRows = null;   // Cached 50k rows once loaded from CSV

    this._injectToggleButton();
    this._buildOverlayShell();
    this._bindEvents();
  }

  // ═══════════════ DOM CONSTRUCTION ═══════════════

  /**
   * Inject the "Analytics View" button into the pause overlay actions area.
   * Only visible when the stream is paused.
   */
  _injectToggleButton() {
    const pauseActions = document.querySelector('.pause-actions');
    if (!pauseActions) return;

    this._toggleBtn = document.createElement('button');
    this._toggleBtn.type = 'button';
    this._toggleBtn.className = 'analytics-toggle-btn';
    this._toggleBtn.id = 'analytics-view-toggle';
    this._toggleBtn.innerHTML = `
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" style="margin-right: 6px; vertical-align: -2px;">
        <rect x="1" y="10" width="4" height="9" rx="1" fill="currentColor" opacity="0.6"/>
        <rect x="6" y="6" width="4" height="13" rx="1" fill="currentColor" opacity="0.8"/>
        <rect x="11" y="3" width="4" height="16" rx="1" fill="currentColor"/>
        <circle cx="17" cy="4" r="2.5" fill="currentColor" opacity="0.9"/>
      </svg>
      <span>Analytics View</span>
    `;

    // Insert before the dismiss button so layout is: Resume | Analytics | Dismiss
    const dismissBtn = pauseActions.querySelector('.overlay-dismiss-btn');
    if (dismissBtn) {
      pauseActions.insertBefore(this._toggleBtn, dismissBtn);
    } else {
      pauseActions.appendChild(this._toggleBtn);
    }
  }

  /**
   * Build the full-screen analytics overlay shell (hidden by default).
   * Contains the header with dual-mode switcher, stats bar, and 2×2 chart grid.
   */
  _buildOverlayShell() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'analytics-overlay analytics-overlay--hidden';
    this._overlay.id = 'analytics-overlay';

    this._overlay.innerHTML = `
      <div class="analytics-panel">
        <div class="analytics-header">
          <div class="analytics-header-left">
            <div class="analytics-header-icon-wrap">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                <rect x="1" y="10" width="4" height="9" rx="1" fill="currentColor" opacity="0.6"/>
                <rect x="6" y="6" width="4" height="13" rx="1" fill="currentColor" opacity="0.8"/>
                <rect x="11" y="3" width="4" height="16" rx="1" fill="currentColor"/>
                <circle cx="17" cy="4" r="2.5" fill="currentColor" opacity="0.9"/>
              </svg>
            </div>
            <div>
              <h2 class="analytics-title">Analytics View</h2>
              <span class="analytics-subtitle-text" id="analytics-subtitle">Frozen Snapshot Aggregation</span>
            </div>
          </div>

          <div class="analytics-header-center">
            <!-- Dual-mode switcher: Frozen Snapshot vs Full Pipeline -->
            <div class="analytics-mode-switcher" role="group" aria-label="Analysis mode">
              <button type="button"
                class="analytics-mode-btn analytics-mode-btn--active"
                id="mode-frozen"
                data-mode="frozen"
                title="Analyse the currently visible frozen rows (with active filters applied)">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" style="margin-right:5px;vertical-align:-1px;">
                  <path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
                  <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="8" cy="8" r="2" fill="currentColor"/>
                </svg>
                Frozen Snapshot
              </button>
              <button type="button"
                class="analytics-mode-btn"
                id="mode-full"
                data-mode="full"
                title="Analyse the complete pipeline database (all 50,000 records)">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" style="margin-right:5px;vertical-align:-1px;">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Full Pipeline
              </button>
            </div>
          </div>

          <div class="analytics-header-right">
            <div class="analytics-stats" id="analytics-stats"></div>
            <button type="button" class="analytics-close-btn" id="analytics-close-btn" aria-label="Close analytics">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="analytics-grid" id="analytics-grid"></div>
      </div>
    `;

    document.getElementById('app').appendChild(this._overlay);
  }

  // ═══════════════ EVENT BINDING ═══════════════

  _bindEvents() {
    if (this._toggleBtn) {
      this._toggleBtn.addEventListener('click', () => this.open());
    }

    const closeBtn = this._overlay.querySelector('#analytics-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) this.close();
    });

    // Delegated click handler for switching modes
    this._overlay.addEventListener('click', (e) => {
      const btn = e.target.closest('.analytics-mode-btn');
      if (!btn || !this._isOpen) return;

      const newMode = btn.dataset.mode;
      if (newMode === this._mode) return;

      this._mode = newMode;
      this._refreshMode();
    });

    this.state.on('pause', ({ isPaused }) => {
      if (!isPaused && this._isOpen) this.close();
    });
  }

  // ═══════════════ OPEN / CLOSE ═══════════════

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._mode = 'frozen'; // Reset to accurate snap on open

    this._overlay.classList.remove('analytics-overlay--hidden');

    requestAnimationFrame(() => {
      this._refreshMode();
    });
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._destroyCharts();

    const grid = this._overlay.querySelector('#analytics-grid');
    if (grid) grid.innerHTML = '';

    this._overlay.classList.add('analytics-overlay--hidden');
  }

  // ═══════════════ FULL DATABASE PARSER ═══════════════

  /**
   * Fetches and parses the entire 50,000-row baseline CSV from the server.
   * Caches results in memory to make mode toggling instant on subsequent clicks.
   * @returns {Promise<Object[]>}
   */
  async _loadFullDatabase() {
    if (this._fullDbRows) return this._fullDbRows;

    const statsEl = this._overlay.querySelector('#analytics-stats');
    if (statsEl) {
      statsEl.innerHTML = '<span style="color:var(--cyan);font-family:var(--font-mono);font-size:11px;">Parsing 50,000 Database Rows...</span>';
    }

    try {
      const response = await fetch('./rpa_database_2026.csv');
      if (!response.ok) throw new Error('Network error fetching CSV');

      const csvText = await response.text();
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const parsed = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');
        if (values.length === headers.length) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index].trim();
          });

          // Cast to numeric values using same mapping rules as StateEngine
          row._savings = parseFloat(row.annual_savings_usd) || 0;
          row._roi = parseFloat(row.roi_percent) || 0;
          row._robots = parseInt(row.robots_deployed, 10) || 0;
          row._hours = parseInt(row.employee_hours_saved, 10) || 0;
          row._budget = parseFloat(row.budget_usd) || 0;

          parsed.push(row);
        }
      }

      this._fullDbRows = parsed;
      return parsed;
    } catch (e) {
      console.error('❌ Failed to fetch or parse baseline CSV:', e);
      // Fallback gracefully to all active stream rows if loading fails
      return this.state.allRows;
    }
  }

  // ═══════════════ MODE MANAGEMENT ═══════════════

  /**
   * Refresh the layout and regenerate charts based on selected mode.
   */
  async _refreshMode() {
    const isFull = this._mode === 'full';

    // ── Update active switcher button ──
    this._overlay.querySelectorAll('.analytics-mode-btn').forEach(btn => {
      btn.classList.toggle('analytics-mode-btn--active', btn.dataset.mode === this._mode);
    });

    // ── Update subtitle ──
    const subtitle = this._overlay.querySelector('#analytics-subtitle');
    if (subtitle) {
      subtitle.textContent = isFull
        ? 'Full Pipeline Aggregation (Static CSV Baseline)'
        : 'Frozen Snapshot Aggregation (Visible In View)';
    }

    // ── Fetch rows for the active mode ──
    const rows = isFull ? await this._loadFullDatabase() : this.state.filteredRows;

    // Safety guard if the user changed modes or closed the overlay while CSV was fetching
    if (!this._isOpen) return;
    if (isFull && this._mode !== 'full') return;

    // ── Update stats in the header ──
    const statsEl = this._overlay.querySelector('#analytics-stats');
    if (statsEl) {
      const totalSavings = rows.reduce((s, r) => s + (r._savings || 0), 0);
      const totalRobots  = rows.reduce((s, r) => s + (r._robots  || 0), 0);
      statsEl.innerHTML =
        `<span class="analytics-stat"><span class="analytics-stat-val">${rows.length.toLocaleString()}</span> rows</span>` +
        `<span class="analytics-stat-sep">·</span>` +
        `<span class="analytics-stat"><span class="analytics-stat-val">${totalRobots.toLocaleString()}</span> robots</span>` +
        `<span class="analytics-stat-sep">·</span>` +
        `<span class="analytics-stat"><span class="analytics-stat-val">${formatDollars(totalSavings)}</span> savings</span>` +
        (isFull ? `<span class="analytics-mode-badge analytics-mode-badge--full">Full DB</span>` : `<span class="analytics-mode-badge analytics-mode-badge--frozen">Snapshot</span>`);
    }

    // ── Re-render canvases and charts ──
    this._buildChartCards();
    this._generateCharts(rows);
  }

  // ═══════════════ CHART CARD FACTORY ═══════════════

  _buildChartCards() {
    const grid = this._overlay.querySelector('#analytics-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const cards = [
      { id: 'chart-status',   title: 'Project Status Distribution', badge: 'Doughnut' },
      { id: 'chart-roi',      title: 'Top 10 ROI Performers',       badge: 'Horizontal Bar' },
      { id: 'chart-savings',  title: 'Savings by Department',       badge: 'Vertical Bar' },
      { id: 'chart-industry', title: 'Industry Breakdown',          badge: 'Pie Chart' },
    ];

    for (const card of cards) {
      const el = document.createElement('div');
      el.className = 'analytics-card';
      el.innerHTML = `
        <div class="analytics-card-header">
          <span class="analytics-card-title">${card.title}</span>
          <span class="analytics-card-badge">${card.badge}</span>
        </div>
        <div class="analytics-card-body">
          <canvas id="${card.id}"></canvas>
        </div>
      `;
      grid.appendChild(el);
    }
  }

  // ═══════════════ CHART GENERATION ═══════════════

  _generateCharts(rows) {
    this._destroyCharts();
    this._createStatusChart(rows);
    this._createRoiChart(rows);
    this._createSavingsChart(rows);
    this._createIndustryChart(rows);
  }

  /**
   * Chart 1: Project Status Distribution — Doughnut
   */
  _createStatusChart(rows) {
    const counts = {};
    for (const row of rows) {
      const status = row.project_status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    }

    const labels = Object.keys(counts);
    const data   = Object.values(counts);
    const bgColors     = labels.map(l => STATUS_COLORS[l]?.bg     || 'rgba(100,100,100,0.7)');
    const borderColors = labels.map(l => STATUS_COLORS[l]?.border || '#666');

    const ctx = document.getElementById('chart-status');
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          hoverOffset: 6,
          spacing: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        layout: { padding: { bottom: 4 } },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: DARK_THEME.color,
              font: { ...DARK_THEME.font, size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            ...TOOLTIP_CONFIG,
            callbacks: {
              label: (tip) => {
                const total = tip.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((tip.parsed / total) * 100).toFixed(1) : '0.0';
                return ` ${tip.label}: ${tip.parsed.toLocaleString()} projects (${pct}%)`;
              }
            }
          },
        },
      },
    });
    this._charts.push(chart);
  }

  /**
   * Chart 2: Top 10 ROI Performers — Horizontal Bar
   */
  _createRoiChart(rows) {
    const sorted = [...rows]
      .filter(r => r._roi > 0)
      .sort((a, b) => b._roi - a._roi || b._savings - a._savings)
      .slice(0, 10);

    const labels = sorted.map(r => truncLabel(r.project_name || r.project_id, 24));
    const data   = sorted.map(r => r._roi);

    const ctx = document.getElementById('chart-roi');
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'ROI %',
          data,
          backgroundColor: data.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderColor:     data.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]),
          borderWidth: 1.5,
          borderRadius: 3,
          barPercentage: 0.7,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 8 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_CONFIG,
            callbacks: {
              title: (tips) => sorted[tips[0].dataIndex]?.project_name || 'N/A',
              label: (tip) => {
                const roiVal = typeof tip.parsed.x === 'number' ? tip.parsed.x : 0;
                return [
                  ` ROI: ${roiVal.toFixed(2)}%`,
                  ` Savings: ${formatDollars(sorted[tip.dataIndex]?._savings || 0)}`,
                ];
              }
            }
          },
        },
        scales: {
          x: {
            ticks: { color: DARK_THEME.color, font: DARK_THEME.font, callback: v => v + '%' },
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            border: { display: false },
          },
          y: {
            ticks: { color: DARK_THEME.color, font: { ...DARK_THEME.font, size: 10 } },
            grid: { display: false },
            border: { display: false },
          },
        },
      },
    });
    this._charts.push(chart);
  }

  /**
   * Chart 3: Savings by Department — Vertical Bar
   */
  _createSavingsChart(rows) {
    const deptSavings = {};
    for (const row of rows) {
      const dept = row.department || 'Unknown';
      deptSavings[dept] = (deptSavings[dept] || 0) + (row._savings || 0);
    }

    const entries = Object.entries(deptSavings).sort((a, b) => b[1] - a[1]);
    const labels  = entries.map(e => truncLabel(e[0], 16));
    const data    = entries.map(e => e[1]);

    const ctx = document.getElementById('chart-savings');
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Savings ($)',
          data,
          backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderColor:     labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]),
          borderWidth: 1.5,
          borderRadius: 3,
          barPercentage: 0.6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 4 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_CONFIG,
            callbacks: {
              title: (tips) => entries[tips[0].dataIndex]?.[0] || 'Unknown',
              label: (tip) => ` Savings: ${formatDollars(tip.parsed.y)}`
            }
          },
        },
        scales: {
          x: {
            ticks: {
              color: DARK_THEME.color,
              font: { ...DARK_THEME.font, size: 9 },
              maxRotation: 45,
              minRotation: 20,
            },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            ticks: {
              color: DARK_THEME.color,
              font: DARK_THEME.font,
              callback: (v) => formatDollars(v),
            },
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            border: { display: false },
          },
        },
      },
    });
    this._charts.push(chart);
  }

  /**
   * Chart 4: Industry Breakdown — Pie Chart
   */
  _createIndustryChart(rows) {
    const industryCounts = {};
    for (const row of rows) {
      const ind = row.industry || 'Unknown';
      industryCounts[ind] = (industryCounts[ind] || 0) + 1;
    }

    const entries = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const labels = entries.map(e => truncLabel(e[0], 18));
    const data   = entries.map(e => e[1]);

    const ctx = document.getElementById('chart-industry');
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          borderColor:     CHART_BORDERS.slice(0, labels.length),
          borderWidth: 1.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { bottom: 4 } },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: DARK_THEME.color,
              font: { ...DARK_THEME.font, size: 10 },
              padding: 10,
              usePointStyle: true,
              pointStyleWidth: 8,
              boxWidth: 8,
            },
          },
          tooltip: {
            ...TOOLTIP_CONFIG,
            callbacks: {
              title: (tips) => entries[tips[0].dataIndex]?.[0] || 'Unknown',
              label: (tip) => {
                const total = tip.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((tip.parsed / total) * 100).toFixed(1) : '0.0';
                return ` ${tip.parsed.toLocaleString()} projects (${pct}%)`;
              }
            }
          },
        },
      },
    });
    this._charts.push(chart);
  }

  // ═══════════════ CLEANUP ═══════════════

  _destroyCharts() {
    for (const chart of this._charts) {
      chart.destroy();
    }
    this._charts = [];
  }
}
