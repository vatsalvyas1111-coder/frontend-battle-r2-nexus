/**
 * ============================================================================
 * BONUS: Snapshot Export — CSV Download of Frozen Dataset (+8 Points)
 * ============================================================================
 * Exports the current active dataset as a downloadable .csv file.
 * Respects the operator's current multi-column sorting sequence,
 * keyword filters, and dropdown filters exactly as displayed in the grid.
 *
 * Implementation:
 * - Reads from state.sortedView (already sorted + filtered)
 * - Builds CSV string in non-blocking chunks via setTimeout to avoid freezing
 * - Uses Blob + URL.createObjectURL for pure client-side download
 * - Shows a brief toast notification on export success
 * - Keyboard shortcut: Ctrl+Shift+E
 *
 * The export button is injected into the header controls area
 * and is always available (works during streaming or paused state).
 */

/** CSV column definitions: header label → row field key */
const CSV_COLUMNS = [
  { header: 'Project ID',           key: 'project_id' },
  { header: 'Project Name',         key: 'project_name' },
  { header: 'Department',           key: 'department' },
  { header: 'Industry',             key: 'industry' },
  { header: 'Automation Type',      key: 'automation_type' },
  { header: 'Project Status',       key: 'project_status' },
  { header: 'Robots Deployed',      key: 'robots_deployed' },
  { header: 'Annual Savings (USD)', key: 'annual_savings_usd' },
  { header: 'ROI (%)',              key: 'roi_percent' },
  { header: 'Budget (USD)',         key: 'budget_usd' },
  { header: 'Employee Hours Saved', key: 'employee_hours_saved' },
  { header: 'Region',               key: 'region' },
  { header: 'Country',              key: 'country' },
  { header: 'Go-Live Date',         key: 'go_live_date' },
  { header: 'Vendor',               key: 'vendor' },
];

/**
 * Escape a CSV field value: wrap in quotes if it contains commas,
 * quotes, or newlines. Double any existing quotes per RFC 4180.
 * @param {*} val
 * @returns {string}
 */
function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export class SnapshotExport {
  /**
   * @param {import('../state/StateEngine.js').StateEngine} state
   */
  constructor(state) {
    this.state = state;
    this._isExporting = false;

    this._injectExportButton();
    this._bindKeyboardShortcut();
  }

  /**
   * Inject the export button into the header controls area.
   */
  _injectExportButton() {
    const headerControls = document.getElementById('header-controls');
    if (!headerControls) return;

    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'snapshot-export-btn';
    this._btn.id = 'snapshot-export-btn';
    this._btn.title = 'Export current view as CSV (Ctrl+Shift+E)';
    this._btn.innerHTML = `
      <svg viewBox="0 0 18 18" width="14" height="14" fill="none" style="margin-right:5px;vertical-align:-2px;">
        <path d="M9 2v10M5 8l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 13v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <span>Export CSV</span>
    `;

    this._btn.addEventListener('click', () => this.export());
    headerControls.appendChild(this._btn);
  }

  /**
   * Bind Ctrl+Shift+E keyboard shortcut for quick export.
   */
  _bindKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        this.export();
      }
    });
  }

  /**
   * Execute the CSV export.
   * Uses chunked processing via setTimeout to avoid blocking the main thread.
   */
  export() {
    if (this._isExporting) return;
    this._isExporting = true;

    // Visual feedback on button
    if (this._btn) {
      this._btn.classList.add('snapshot-export-btn--working');
      this._btn.querySelector('span').textContent = 'Exporting…';
    }

    // Read the current sorted+filtered view (exact grid state)
    const rows = this.state.sortedView;
    const totalRows = rows.length;

    if (totalRows === 0) {
      this._showToast('No data to export', 'warning');
      this._resetButton();
      return;
    }

    // ── Build CSV in non-blocking chunks ──
    const CHUNK_SIZE = 2000; // rows per chunk
    const headerLine = CSV_COLUMNS.map(c => escapeCsvField(c.header)).join(',');
    const csvChunks = [headerLine];
    let currentIndex = 0;

    const processChunk = () => {
      const end = Math.min(currentIndex + CHUNK_SIZE, totalRows);

      for (let i = currentIndex; i < end; i++) {
        const row = rows[i];
        const line = CSV_COLUMNS.map(col => escapeCsvField(row[col.key])).join(',');
        csvChunks.push(line);
      }

      currentIndex = end;

      if (currentIndex < totalRows) {
        // More rows remaining — yield to browser then continue
        setTimeout(processChunk, 0);
      } else {
        // All rows processed — trigger download
        this._triggerDownload(csvChunks.join('\n'), totalRows);
      }
    };

    // Start chunked processing on next tick (non-blocking)
    setTimeout(processChunk, 0);
  }

  /**
   * Create a Blob from the CSV string and trigger a browser download.
   * @param {string} csvContent
   * @param {number} rowCount
   */
  _triggerDownload(csvContent, rowCount) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Generate timestamped filename
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `nexus-snapshot-${timestamp}.csv`;

    // Create ephemeral download link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);

    this._showToast(`Exported ${rowCount.toLocaleString()} rows → ${filename}`, 'success');
    this._resetButton();
  }

  /**
   * Reset the export button to its default state.
   */
  _resetButton() {
    this._isExporting = false;
    if (this._btn) {
      this._btn.classList.remove('snapshot-export-btn--working');
      this._btn.querySelector('span').textContent = 'Export CSV';
    }
  }

  /**
   * Show a brief toast notification at the bottom of the screen.
   * @param {string} message
   * @param {'success' | 'warning'} type
   */
  _showToast(message, type = 'success') {
    // Remove existing toast if any
    const existing = document.querySelector('.snapshot-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `snapshot-toast snapshot-toast--${type}`;
    toast.innerHTML = `
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;">
        ${type === 'success'
          ? '<path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<path d="M8 5v4M8 11h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        }
      </svg>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      toast.classList.add('snapshot-toast--visible');
    });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      toast.classList.remove('snapshot-toast--visible');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
}
