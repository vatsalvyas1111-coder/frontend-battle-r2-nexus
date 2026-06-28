/**
 * ============================================================================
 * Search Bar Component (Feature 10 - 5 Points)
 * ============================================================================
 * Input field with debounced fuzzy search.
 * Delegates actual matching to the StateEngine's FuzzySearch integration.
 */

export class SearchBar {
  /**
   * @param {HTMLElement} container - Mount point (#search-container)
   * @param {import('../state/StateEngine.js').StateEngine} state
   */
  constructor(container, state) {
    this.container = container;
    this.state = state;

    this._debounceTimer = null;
    this._DEBOUNCE_MS = 150;

    this._buildDOM();
  }

  _buildDOM() {
    this.container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'search-wrap';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'search-icon');
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.setAttribute('fill', 'currentColor');

    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('fill-rule', 'evenodd');
    iconPath.setAttribute('clip-rule', 'evenodd');
    iconPath.setAttribute('d', 'M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z');
    icon.appendChild(iconPath);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-input';
    input.id = 'fuzzy-search-input';
    input.placeholder = 'Fuzzy search - project, company, partner, country...';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('aria-label', 'Search telemetry data');

    input.addEventListener('input', () => {
      this._onInput(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        this.state.setSearch('');
      }
    });

    wrap.appendChild(icon);
    wrap.appendChild(input);
    this.container.appendChild(wrap);
  }

  /**
   * Debounced input handler.
   * Prevents search recomputation on every keystroke.
   */
  _onInput(value) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.state.setSearch(value);
    }, this._DEBOUNCE_MS);
  }
}
