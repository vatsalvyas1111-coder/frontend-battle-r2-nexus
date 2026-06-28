/**
 * ============================================================================
 * Settings Manager — Operator Customization Panel
 * ============================================================================
 * Orchestrates customizable UI parameters and persists configurations
 * within browser local storage.
 * 
 * Configurable Toggles:
 * 1. Row Update Flash: Suspends/engages the visual update anim for reduced CPU load.
 * 2. Performance HUD: Toggles the live FPS, render latency, and tick stats overlay.
 * 3. Active Movement (Auto-scroll): Triggers a smooth requestAnimationFrame scroll
 *    waterfall that automatically pauses when the operator hovers over the viewport.
 * 4. Themes: Custom sub-themes (Cyberpunk, Matrix Green, Obsidian) applied via body attributes.
 */

const SETTINGS_KEY = 'nexus-rpa-settings-v1';

export class SettingsManager {
  /**
   * @param {HTMLElement} triggerContainer - Header element to mount settings gear icon (#settings-trigger-container)
   * @param {HTMLElement} appContainer - Root element to apply theme/state classes (#app)
   * @param {import('../state/StateEngine.js').StateEngine} state
   * @param {import('../core/VirtualGrid.js').VirtualGrid} virtualGrid
   */
  constructor(triggerContainer, appContainer, state, virtualGrid) {
    this.triggerContainer = triggerContainer;
    this.appContainer = appContainer;
    this.state = state;
    this.virtualGrid = virtualGrid;

    this.settings = {
      rowFlash: true,
      perfHud: true,
      autoscroll: true,
      scrollSpeed: 'slow', // 'slow' (smooth) | 'medium' | 'fast'
      theme: 'cyberpunk', // 'cyberpunk' | 'matrix' | 'obsidian'
    };

    this._panel = null;
    this._loadSettings();
    this._buildDOM();
    this._applySettings();
  }

  _loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      // Ignore
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      // Ignore
    }
  }

  _buildDOM() {
    // 1. Create Gear Trigger Button in the Header
    const gearBtn = document.createElement('button');
    gearBtn.className = 'header-btn settings-gear-btn';
    gearBtn.id = 'settings-toggle-btn';
    gearBtn.type = 'button';
    gearBtn.setAttribute('aria-label', 'Open monitor settings');
    gearBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;
    this.triggerContainer.appendChild(gearBtn);

    // 2. Create the Settings Slide-Out Drawer Panel
    this._panel = document.createElement('div');
    this._panel.className = 'settings-panel hidden';
    this._panel.innerHTML = `
      <div class="settings-header">
        <h3 class="settings-title">Monitor Settings</h3>
        <button class="settings-close" id="settings-close-btn" type="button" aria-label="Close settings">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
        </button>
      </div>
      <div class="settings-body">
        <!-- Section: Visual Experience -->
        <div class="settings-section">
          <h4 class="settings-section-title">Visual Animations</h4>
          
          <label class="setting-row">
            <span class="setting-label-text">
              <strong>Row Update Flash</strong>
              <small>Flash rows when new data batches arrive</small>
            </span>
            <input type="checkbox" id="setting-opt-row-flash" class="setting-checkbox">
          </label>
          
          <label class="setting-row">
            <span class="setting-label-text">
              <strong>Performance HUD</strong>
              <small>Display real-time FPS & measured latency</small>
            </span>
            <input type="checkbox" id="setting-opt-perf-hud" class="setting-checkbox">
          </label>
          
          <label class="setting-row">
            <span class="setting-label-text">
              <strong>Active Movement (Auto-scroll)</strong>
              <small>Automatically scroll grid to top on updates</small>
            </span>
            <input type="checkbox" id="setting-opt-autoscroll" class="setting-checkbox">
          </label>

          <div class="setting-row setting-row--sub" id="setting-scroll-speed-container">
            <span class="setting-label-text">
              <strong>Auto-scroll Speed</strong>
              <small>Crawl frequency rate (Smooth = Recommended)</small>
            </span>
            <select id="setting-opt-scroll-speed" class="setting-select">
              <option value="slow">Smooth (Slow Crawl)</option>
              <option value="medium">Medium Flow</option>
              <option value="fast">Fast Sweep</option>
            </select>
          </div>
        </div>

        <!-- Section: Operator Sub-Theme -->
        <div class="settings-section">
          <h4 class="settings-section-title">Monitor Palette Theme</h4>
          <div class="theme-picker">
            <button class="theme-choice-btn active" data-theme="cyberpunk" style="--btn-color: #00d4ff;">Cyberpunk</button>
            <button class="theme-choice-btn" data-theme="matrix" style="--btn-color: #34d399;">Matrix Green</button>
            <button class="theme-choice-btn" data-theme="obsidian" style="--btn-color: #8b5cf6;">Obsidian</button>
          </div>
        </div>
      </div>
    `;
    this.appContainer.appendChild(this._panel);

    // 3. Bind Event Handlers
    gearBtn.addEventListener('click', () => this.togglePanel());
    
    const closeBtn = this._panel.querySelector('#settings-close-btn');
    closeBtn.addEventListener('click', () => this.closePanel());

    // Input elements
    const rowFlashCheck = this._panel.querySelector('#setting-opt-row-flash');
    const perfHudCheck = this._panel.querySelector('#setting-opt-perf-hud');
    const autoscrollCheck = this._panel.querySelector('#setting-opt-autoscroll');
    const scrollSpeedSelect = this._panel.querySelector('#setting-opt-scroll-speed');

    rowFlashCheck.checked = this.settings.rowFlash;
    perfHudCheck.checked = this.settings.perfHud;
    autoscrollCheck.checked = this.settings.autoscroll;
    scrollSpeedSelect.value = this.settings.scrollSpeed || 'slow';

    rowFlashCheck.addEventListener('change', (e) => {
      this.settings.rowFlash = e.target.checked;
      this._saveSettings();
      this._applySettings();
    });

    perfHudCheck.addEventListener('change', (e) => {
      this.settings.perfHud = e.target.checked;
      this._saveSettings();
      this._applySettings();
    });

    autoscrollCheck.addEventListener('change', (e) => {
      this.settings.autoscroll = e.target.checked;
      this._saveSettings();
      this._applySettings();
    });

    scrollSpeedSelect.addEventListener('change', (e) => {
      this.settings.scrollSpeed = e.target.value;
      this._saveSettings();
      this._applySettings();
    });

    // Theme pickers
    const themeBtns = this._panel.querySelectorAll('.theme-choice-btn');
    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.theme = btn.dataset.theme;
        this._saveSettings();
        this._applySettings();
      });
    });
  }

  togglePanel() {
    this._panel.classList.toggle('hidden');
  }

  closePanel() {
    this._panel.classList.add('hidden');
  }

  _applySettings() {
    this.virtualGrid.autoscrollEnabled = this.settings.autoscroll;
    this.virtualGrid.scrollSpeed = this.settings.scrollSpeed || 'slow';

    // Show/hide/disable scroll speed setting container based on auto-scroll checkbox state
    const speedContainer = this._panel.querySelector('#setting-scroll-speed-container');
    if (speedContainer) {
      speedContainer.classList.toggle('disabled', !this.settings.autoscroll);
    }

    // Apply row flash flag to App element class to toggle visual css
    this.appContainer.classList.toggle('opt-disable-row-flash', !this.settings.rowFlash);
    
    // Toggle HUD visibility
    const perfHud = document.getElementById('grid-perf-hud');
    if (perfHud) {
      perfHud.classList.toggle('hidden', !this.settings.perfHud);
    }

    // Apply subtheme classes to body
    document.body.classList.remove('theme-cyberpunk', 'theme-matrix', 'theme-obsidian');
    document.body.classList.add(`theme-${this.settings.theme}`);

    // Update active button indicator class
    const themeBtns = this._panel.querySelectorAll('.theme-choice-btn');
    themeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === this.settings.theme);
    });
  }
}
