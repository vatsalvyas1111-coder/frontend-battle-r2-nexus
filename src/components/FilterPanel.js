/**
 * ============================================================================
 * Feature 7: Categorical Dropdown Filters (10 Points)
 * ============================================================================
 * Multi-choice dropdowns for `automation_type`, `department`, and `industry`.
 * 
 * Polish Features:
 * - Dynamic Discovery: Automatically collects new unique values as they appear
 *   in the data stream.
 * - Selection Persistence: Preserves the active dropdown filter selections when
 *   options are rebuilt.
 * - Anti-Churn Optimization: Rebuilds options only if the number of unique
 *   values changes, preventing DOM overhead.
 */

export class FilterPanel {
  /**
   * @param {HTMLElement} container - Mount point (#filter-container)
   * @param {import('../state/StateEngine.js').StateEngine} state
   */
  constructor(container, state) {
    this.container = container;
    this.state = state;

    this._selects = {};
    this._lastOptionCounts = {};

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this.container.innerHTML = '';

    const filters = [
      { field: 'automation_type', label: 'Automation Type' },
      { field: 'department',      label: 'Department' },
      { field: 'industry',        label: 'Industry' },
    ];

    for (const f of filters) {
      const select = document.createElement('select');
      select.className = 'filter-select';
      select.id = `filter-${f.field}`;
      select.setAttribute('aria-label', `Filter by ${f.label}`);

      // Default option
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = `All ${f.label}s`;
      select.appendChild(defaultOpt);

      select.addEventListener('change', () => {
        const value = select.value;
        this.state.setFilter(f.field, value);
        select.classList.toggle('filter-active', value !== '');
      });

      this.container.appendChild(select);
      this._selects[f.field] = select;
      this._lastOptionCounts[f.field] = 0;
    }
  }

  _bindEvents() {
    this.state.on('filter-options', (options) => {
      this._updateOptions(options);
    });
  }

  /**
   * Update dropdown options when new values are discovered from the stream.
   * Only rebuilds options when the count changes (avoids DOM churn).
   */
  _updateOptions(options) {
    for (const [field, valuesSet] of Object.entries(options)) {
      const select = this._selects[field];
      if (!select) continue;

      // Only update if new options were added
      if (valuesSet.size === this._lastOptionCounts[field]) continue;
      this._lastOptionCounts[field] = valuesSet.size;

      // Preserve current selection
      const currentValue = select.value;

      // Sort options alphabetically
      const sorted = Array.from(valuesSet).sort();

      // Rebuild options (keep default "All" option)
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }

      for (const val of sorted) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
      }

      // Restore selection
      select.value = currentValue;
    }
  }
}
