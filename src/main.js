/**
 * ============================================================================
 * NEXUS RPA Control Terminal — Application Entry Point
 * ============================================================================
 * Bootstraps all components, initializes the telemetry stream,
 * and wires the state engine to the UI modules.
 *
 * Architecture: StateEngine (central) ← dataStream.js (input)
 *               StateEngine → Components (output via pub/sub)
 *
 * Boot Sequence:
 *   1. IntroSplash plays intro.mp4 (cinematic first impression)
 *   2. On splash dismiss → bootstrap() initializes all modules
 *   3. Telemetry stream connects and begins processing
 */

import './styles/main.css';

import { StateEngine } from './state/StateEngine.js';
import { VirtualGrid } from './core/VirtualGrid.js';
import { KPIDashboard } from './components/KPIDashboard.js';
import { StreamControls } from './components/StreamControls.js';
import { FilterPanel } from './components/FilterPanel.js';
import { SearchBar } from './components/SearchBar.js';
import { LayoutManager } from './components/LayoutManager.js';
import { SettingsManager } from './components/SettingsManager.js';
import { AnalyticsOverlay } from './components/AnalyticsOverlay.js';
import { IntroSplash } from './components/IntroSplash.js';
import { SnapshotExport } from './components/SnapshotExport.js';
import { SystemInfoModal } from './components/SystemInfoModal.js';

// ── FPS Counter (runs independently, always) ──
let _fps = 60;
let _frameCount = 0;
let _lastFpsTime = performance.now();

(function trackFPS() {
  _frameCount++;
  const now = performance.now();
  if (now - _lastFpsTime >= 1000) {
    _fps = _frameCount;
    _frameCount = 0;
    _lastFpsTime = now;
  }
  requestAnimationFrame(trackFPS);
})();

/**
 * Application bootstrap.
 * Runs after IntroSplash completes and DOM is ready.
 */
function bootstrap() {
  console.log('🚀 [NEXUS] Bootstrapping Enterprise RPA Control Terminal...');

  // ── 1. Initialize Central State Engine ──
  const state = new StateEngine();

  // ── 2. Mount UI Components ──
  const kpiContainer = document.getElementById('kpi-grid');
  const controlsContainer = document.getElementById('header-controls');
  const filterContainer = document.getElementById('filter-container');
  const searchContainer = document.getElementById('search-container');
  const layoutContainer = document.getElementById('layout-toggles');
  const gridContainer = document.getElementById('grid-container');

  const kpiDashboard = new KPIDashboard(kpiContainer, state);
  const streamControls = new StreamControls(controlsContainer, state);
  const filterPanel = new FilterPanel(filterContainer, state);
  const searchBar = new SearchBar(searchContainer, state);
  const layoutManager = new LayoutManager(layoutContainer);
  const virtualGrid = new VirtualGrid(gridContainer, state);

  // ── Settings Panel Manager ──
  const settingsContainer = document.getElementById('settings-trigger-container');
  const appContainer = document.getElementById('app');
  const settingsManager = new SettingsManager(settingsContainer, appContainer, state, virtualGrid);

  // ── Analytics Overlay (Bonus Feature — Chart.js visualization when paused) ──
  const analyticsOverlay = new AnalyticsOverlay(state);

  // ── Snapshot Export (Bonus Feature — CSV export of frozen dataset) ──
  const snapshotExport = new SnapshotExport(state);

  // ── System Info Modal ("More Info" feature showcase for judges) ──
  const systemInfoModal = new SystemInfoModal();

  // ── 3. Wire up row count updates ──
  state.on('data', () => {
    virtualGrid.updateRowCount();
  });

  // ── 4. Performance HUD ──
  const perfEl = document.getElementById('grid-perf-hud');
  let _lastTickMs = 0;
  let _tickInterval = 200;

  state.on('tick', ({ batchSize }) => {
    const now = performance.now();
    if (_lastTickMs > 0) {
      _tickInterval = Math.round(now - _lastTickMs);
    }
    _lastTickMs = now;

    if (perfEl) {
      const renderMs = (virtualGrid.lastRenderTimeMs || 0).toFixed(2);
      perfEl.innerHTML =
        `<span class="perf-fps">${_fps} FPS</span>` +
        `<span class="perf-sep">·</span>` +
        `<span class="perf-tick">${_tickInterval}ms latency</span>` +
        `<span class="perf-sep">·</span>` +
        `<span class="perf-render">${renderMs}ms render</span>` +
        `<span class="perf-sep">·</span>` +
        `<span class="perf-rows">${batchSize} rows/tick</span>`;
    }
  });

  state.on('pause', ({ isPaused }) => {
    if (perfEl) {
      if (isPaused) {
        perfEl.innerHTML =
          `<span class="perf-fps">${_fps} FPS</span>` +
          `<span class="perf-sep">·</span>` +
          `<span class="perf-tick" style="color: var(--amber); font-weight: 700;">STREAM PAUSED</span>`;
      } else {
        perfEl.innerHTML =
          `<span class="perf-fps">${_fps} FPS</span>` +
          `<span class="perf-sep">·</span>` +
          `<span class="perf-tick" style="color: var(--green-bright); font-weight: 700;">STREAM ACTIVE</span>`;
      }
    }
  });

  // ── 5. Connect to Telemetry Stream ──
  console.log('📡 [NEXUS] Connecting to hackathon telemetry pipeline...');

  if (typeof window.initializeRpaStream === 'function') {
    window.initializeRpaStream((incomingBatch) => {
      state.process(incomingBatch);
    }, './rpa_database_2026.csv');

    streamControls.setConnected();
    console.log('✅ [NEXUS] Telemetry stream connected. Processing data...');
  } else {
    console.error('❌ [NEXUS] dataStream.js not loaded. Ensure <script src="/dataStream.js"> is in index.html');

    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    if (statusDot) statusDot.style.background = 'var(--red)';
    if (statusText) statusText.textContent = 'Stream Error';
  }

  console.log('🎯 [NEXUS] All modules initialized. Terminal ready.');
}

// ── Wait for DOM, then show intro splash before bootstrapping ──
function init() {
  const app = document.getElementById('app');
  if (app) app.style.opacity = '0';

  new IntroSplash(() => {
    if (app) {
      app.style.transition = 'opacity 600ms ease-out';
      app.style.opacity = '1';
    }
    bootstrap();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
