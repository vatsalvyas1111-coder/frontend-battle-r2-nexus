/**
 * ============================================================================
 * Feature 6: Operator Workspace Layout Persistence (10 Points)
 * ============================================================================
 * Manages visibility toggles for major dashboard panels (KPIs, Filters, Grid).
 * 
 * Safety Abstraction:
 * - Deadlock Prevention: Mounts toggles inside the global header bar rather than
 *   the toolbar section itself. This guarantees that hiding the toolbar panel 
 *   does not hide the toggle buttons themselves, avoiding self-hiding locks.
 * - Local Storage Sync: Toggles are saved under 'nexus-rpa-layout-v1' to survive
 *   hard page refreshes.
 */

const STORAGE_KEY = 'nexus-rpa-layout-v1';

/** Panel definitions */
const PANELS = [
  { id: 'kpi',     label: 'KPIs',    sectionId: 'kpi-section' },
  { id: 'toolbar', label: 'Filters', sectionId: 'toolbar-section' },
  { id: 'grid',    label: 'Grid',    sectionId: 'grid-section' },
];

export class LayoutManager {
  /**
   * @param {HTMLElement} container - Mount point (#layout-toggles)
   */
  constructor(container) {
    this.container = container;
    this._buttons = {};
    this._state = {};

    this._loadState();
    this._buildDOM();
    this._applyState();
  }

  /**
   * Load saved layout state from localStorage.
   */
  _loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this._state = JSON.parse(saved);
      }
    } catch (e) {
      // Ignore parse errors
    }

    // Default: all panels visible
    for (const panel of PANELS) {
      if (this._state[panel.id] === undefined) {
        this._state[panel.id] = true;
      }
    }
  }

  /**
   * Save current state to localStorage.
   */
  _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
    } catch (e) {
      // Storage full or unavailable — fail silently
    }
  }

  _buildDOM() {
    this.container.innerHTML = '';

    // Label
    const label = document.createElement('span');
    label.className = 'layout-label';
    label.textContent = 'Panels:';
    label.style.cssText = 'font-size:10px;color:var(--text-dim);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-right:4px;display:flex;align-items:center;';
    this.container.appendChild(label);

    for (const panel of PANELS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'layout-toggle';
      btn.id = `layout-toggle-${panel.id}`;
      btn.textContent = panel.label;
      btn.setAttribute('aria-label', `Toggle ${panel.label} panel visibility`);
      btn.setAttribute('aria-pressed', String(this._state[panel.id]));

      btn.addEventListener('click', () => {
        this._toggle(panel.id);
      });

      this.container.appendChild(btn);
      this._buttons[panel.id] = btn;
    }
  }

  /**
   * Toggle a panel's visibility.
   */
  _toggle(panelId) {
    this._state[panelId] = !this._state[panelId];
    this._saveState();
    this._applyState();
  }

  /**
   * Apply current visibility state to the DOM.
   */
  _applyState() {
    for (const panel of PANELS) {
      const section = document.getElementById(panel.sectionId);
      const btn = this._buttons[panel.id];

      if (section) {
        if (this._state[panel.id]) {
          section.classList.remove('panel-hidden');
        } else {
          section.classList.add('panel-hidden');
        }
      }

      if (btn) {
        btn.classList.toggle('active', this._state[panel.id]);
        btn.setAttribute('aria-pressed', String(this._state[panel.id]));
      }
    }
  }
}
