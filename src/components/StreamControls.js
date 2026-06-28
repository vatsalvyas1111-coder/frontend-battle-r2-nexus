/**
 * ============================================================================
 * Stream Controls - Pause/Play Buffer (Feature 5 - 10 Points)
 * ============================================================================
 * Global Pause/Play toggle button.
 * - When paused: UI freezes, but StateEngine continues buffering data
 * - When resumed: buffer flushes seamlessly
 * - Visual overlay shows buffered row count
 */

export class StreamControls {
  /**
   * @param {HTMLElement} container - Mount point (#header-controls)
   * @param {import('../state/StateEngine.js').StateEngine} state
   */
  constructor(container, state) {
    this.container = container;
    this.state = state;

    this._button = null;
    this._buttonIcon = null;
    this._buttonLabel = null;
    this._overlay = document.getElementById('pause-overlay');
    this._bufferCount = document.getElementById('pause-buffer-count');
    this._statusDot = document.getElementById('status-dot');
    this._statusText = document.getElementById('status-text');

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this._button = document.createElement('button');
    this._button.className = 'stream-btn';
    this._button.id = 'pause-play-btn';
    this._button.type = 'button';
    this._button.setAttribute('aria-label', 'Pause or resume telemetry stream');

    this._buttonIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._buttonIcon.setAttribute('viewBox', '0 0 16 16');

    this._buttonLabel = document.createElement('span');

    this._button.appendChild(this._buttonIcon);
    this._button.appendChild(this._buttonLabel);
    this._updateButtonUI(false);

    this.container.appendChild(this._button);
  }

  _bindEvents() {
    this._button.addEventListener('click', () => {
      const isPaused = this.state.togglePause();
      this._updateButtonUI(isPaused);
    });

    const overlayResumeBtn = document.getElementById('overlay-resume-btn');
    if (overlayResumeBtn) {
      overlayResumeBtn.addEventListener('click', () => {
        this.state.togglePause();
      });
    }

    const overlayDismissBtn = document.getElementById('overlay-dismiss-btn');
    if (overlayDismissBtn) {
      overlayDismissBtn.addEventListener('click', () => {
        if (this._overlay) {
          this._overlay.classList.add('hidden');
        }
      });
    }

    this.state.on('pause-update', ({ buffered }) => {
      if (this._bufferCount) {
        this._bufferCount.textContent = buffered.toLocaleString();
      }
    });

    this.state.on('pause', ({ isPaused }) => {
      this._updateButtonUI(isPaused);
    });
  }

  _updateButtonUI(isPaused) {
    this._buttonIcon.replaceChildren();

    if (isPaused) {
      const playIcon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      playIcon.setAttribute('points', '3,1 13,8 3,15');
      playIcon.setAttribute('fill', 'currentColor');
      this._buttonIcon.appendChild(playIcon);

      this._buttonLabel.textContent = 'Resume';
      this._button.classList.add('is-paused');
      this._button.setAttribute('aria-label', 'Resume telemetry stream');

      if (this._overlay) this._overlay.classList.remove('hidden');
      if (this._statusDot) this._statusDot.className = 'status-dot paused';
      if (this._statusText) this._statusText.textContent = 'Paused';
    } else {
      const leftBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      leftBar.setAttribute('x', '2');
      leftBar.setAttribute('y', '1');
      leftBar.setAttribute('width', '4');
      leftBar.setAttribute('height', '14');
      leftBar.setAttribute('rx', '1');
      leftBar.setAttribute('fill', 'currentColor');

      const rightBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rightBar.setAttribute('x', '10');
      rightBar.setAttribute('y', '1');
      rightBar.setAttribute('width', '4');
      rightBar.setAttribute('height', '14');
      rightBar.setAttribute('rx', '1');
      rightBar.setAttribute('fill', 'currentColor');

      this._buttonIcon.appendChild(leftBar);
      this._buttonIcon.appendChild(rightBar);

      this._buttonLabel.textContent = 'Pause';
      this._button.classList.remove('is-paused');
      this._button.setAttribute('aria-label', 'Pause telemetry stream');

      if (this._overlay) this._overlay.classList.add('hidden');
      if (this._statusDot) this._statusDot.className = 'status-dot live';
      if (this._statusText) this._statusText.textContent = 'Live';
    }
  }

  /**
   * Set stream as connected (called once dataStream starts).
   */
  setConnected() {
    if (this._statusDot) this._statusDot.className = 'status-dot live';
    if (this._statusText) this._statusText.textContent = 'Live';
  }
}
