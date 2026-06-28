/**
 * ============================================================================
 * IntroSplash — Cinematic Loading Screen
 * ============================================================================
 * Plays a fullscreen intro video (intro.mp4) on first load, then fades
 * into the main application. Pure HTML5 <video> — no external libraries.
 *
 * Behaviour:
 * - Covers the entire viewport with the video
 * - Shows a subtle "NEXUS" wordmark + loading bar during playback
 * - Auto-dismisses after video ends OR after 8s timeout (whichever first)
 * - Click/tap anywhere to skip immediately
 * - Gracefully falls back to a 3s CSS animation if video fails to load
 * - Calls onComplete() callback to trigger app bootstrap
 */

export class IntroSplash {
  /**
   * @param {Function} onComplete — called once the splash is dismissed
   */
  constructor(onComplete) {
    this._onComplete = onComplete;
    this._dismissed = false;
    this._el = null;
    this._video = null;
    this._progressBar = null;
    this._progressInterval = null;
    this._fallbackTimeout = null;

    this._build();
    this._bind();
    this._start();
  }

  /**
   * Build the splash screen DOM.
   */
  _build() {
    this._el = document.createElement('div');
    this._el.className = 'intro-splash';
    this._el.id = 'intro-splash';

    this._el.innerHTML = `
      <video class="intro-splash-video" muted playsinline preload="auto">
        <source src="/intro.mp4" type="video/mp4">
      </video>

      <div class="intro-splash-overlay">
        <div class="intro-splash-content">
          <div class="intro-splash-logo">
            <div class="intro-splash-icon">
              <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                <rect x="2" y="20" width="8" height="18" rx="2" fill="currentColor" opacity="0.5"/>
                <rect x="12" y="12" width="8" height="26" rx="2" fill="currentColor" opacity="0.7"/>
                <rect x="22" y="4" width="8" height="34" rx="2" fill="currentColor" opacity="0.9"/>
                <circle cx="35" cy="7" r="4" fill="currentColor"/>
              </svg>
            </div>
            <div class="intro-splash-text">
              <span class="intro-splash-title">NEXUS</span>
              <span class="intro-splash-subtitle">RPA Control Terminal</span>
            </div>
          </div>

          <div class="intro-splash-progress-track">
            <div class="intro-splash-progress-bar" id="intro-progress-bar"></div>
          </div>

          <span class="intro-splash-hint">Click anywhere to skip</span>
        </div>
      </div>
    `;

    document.body.prepend(this._el);
    this._video = this._el.querySelector('video');
    this._progressBar = this._el.querySelector('#intro-progress-bar');
  }

  /**
   * Bind events: video end, click to skip, error fallback.
   */
  _bind() {
    // Video ended naturally → dismiss
    this._video.addEventListener('ended', () => this._dismiss());

    // Video error → fall back to CSS-only animation for 3s
    this._video.addEventListener('error', () => {
      this._video.style.display = 'none';
      this._fallbackTimeout = setTimeout(() => this._dismiss(), 3000);
    });

    // Click anywhere to skip
    this._el.addEventListener('click', () => this._dismiss());

    // Safety timeout: dismiss after 9s no matter what
    setTimeout(() => this._dismiss(), 9000);
  }

  /**
   * Start video playback and progress bar animation.
   */
  _start() {
    // Attempt autoplay (muted videos autoplay in all modern browsers)
    const playPromise = this._video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay blocked → fallback
        this._video.style.display = 'none';
        this._fallbackTimeout = setTimeout(() => this._dismiss(), 3000);
      });
    }

    // Animate progress bar based on video currentTime
    this._progressInterval = setInterval(() => {
      if (this._video.duration && this._video.duration > 0) {
        const pct = (this._video.currentTime / this._video.duration) * 100;
        if (this._progressBar) {
          this._progressBar.style.width = pct + '%';
        }
      }
    }, 50);
  }

  /**
   * Dismiss the splash screen with a fade-out, then remove from DOM.
   */
  _dismiss() {
    if (this._dismissed) return;
    this._dismissed = true;

    // Stop progress tracking
    clearInterval(this._progressInterval);
    clearTimeout(this._fallbackTimeout);

    // Pause video
    try { this._video.pause(); } catch (_) { /* noop */ }

    // Fade out
    this._el.classList.add('intro-splash--leaving');

    // Remove from DOM after animation completes, then bootstrap app
    setTimeout(() => {
      this._el.remove();
      this._onComplete();
    }, 800); // matches CSS transition duration
  }
}
