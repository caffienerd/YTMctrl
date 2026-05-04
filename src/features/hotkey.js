// hotkey.js
// Space = Play/Pause | N = Next | B = Previous | L = Loop toggle
// ← / → = Seek ±5s | - / = = Volume (native, toast shown)
// 0-9 = Seek to 0%-90% of track
// / = Open palette | Shift+P = Add to playlist
// P = Play playlist (if on playlist page)
// Backspace = Go back (SPA, no reload)
// Ctrl+/ = Shortcuts popout

function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable ||
    el.closest("ytmusic-search-box") !== null ||
    el.getAttribute("role") === "textbox"
  );
}

function getBar() {
  return document.querySelector("ytmusic-player-bar");
}

function findBtn(...labels) {
  const bar = getBar();
  if (!bar) return null;
  for (const label of labels) {
    const btn = bar.querySelector(`[aria-label="${label}"]`);
    if (btn) return btn;
  }
  for (const label of labels) {
    for (const btn of bar.querySelectorAll(
      "button, paper-icon-button, yt-icon-button",
    )) {
      if (
        (btn.getAttribute("aria-label") || "")
          .toLowerCase()
          .includes(label.toLowerCase())
      )
        return btn;
    }
  }
  return null;
}

function prev() {
  findBtn("Previous", "Previous song")?.click();
}
function playPause() {
  findBtn("Pause", "Play")?.click();
}
function next() {
  findBtn("Next", "Next song")?.click();
}
function loop() {
  findBtn("Repeat", "Repeat off", "Repeat one", "Repeat all")?.click();
}

function seekBy(sec) {
  const video = document.querySelector("video");
  if (video) {
    video.currentTime = Math.max(0, video.currentTime + sec);
    return;
  }
  const slider = document.querySelector("#progress-bar");
  if (slider) {
    const max = parseFloat(slider.getAttribute("max") || 0);
    const cur = parseFloat(slider.getAttribute("value") || 0);
    if (max > 0) {
      slider.setAttribute("value", Math.min(max, Math.max(0, cur + sec)));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

// ── SPA back navigation ───────────────────────────────────────────────────────
function goBack() {
  if (window.history.length > 1) window.history.back();
}

// ── Play button on playlist page ──────────────────────────────────────────────
function playPlaylistPage() {
  if (location.pathname !== "/playlist") return;
  const btn = document.querySelector(
    'ytmusic-responsive-header-renderer ytmusic-play-button-renderer[aria-label^="Play"]',
  );
  btn?.click();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;

function showToast(text) {
  let toast = document.getElementById("ytm-hk-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "ytm-hk-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e2030;
      border: 1px solid #494d64;
      color: #cad3f5;
      font-family: 'YouTube Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 16px;
      border-radius: 20px;
      z-index: 999997;
      pointer-events: none;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      transition: opacity 0.15s ease;
      opacity: 0;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
  }, 1500);
}

// ── Volume toast — listen on video volumechange ───────────────────────────────
function attachVolumeListener() {
  const video = document.querySelector("video");
  if (!video || video._ytmVolListener) return;
  video._ytmVolListener = true;
  video.addEventListener("volumechange", () => {
    const pct = video.muted ? 0 : Math.round(video.volume * 100);
    const icon =
      video.muted || pct === 0
        ? "🔇"
        : pct < 40
          ? "🔈"
          : pct < 75
            ? "🔉"
            : "🔊";
    showToast(`${icon} ${pct}%`);
  });
}

// Video may not exist yet on document_idle — wait for it
(function waitForVideo() {
  if (document.querySelector("video")) {
    attachVolumeListener();
  } else {
    const obs = new MutationObserver(() => {
      if (document.querySelector("video")) {
        obs.disconnect();
        attachVolumeListener();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();

// ── Seek toast helper ─────────────────────────────────────────────────────────
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function seekToPercent(pct) {
  const video = document.querySelector("video");
  if (!video || !video.duration) return;
  video.currentTime = video.duration * pct;
  showToast(
    `⏩ ${formatTime(video.currentTime)} / ${formatTime(video.duration)}`,
  );
}

function changeVol(delta) {
  const video = document.querySelector("video");
  if (!video) return;
  video.volume = Math.min(1, Math.max(0, video.volume + delta));
}

// ── Main keydown handler ──────────────────────────────────────────────────────
document.addEventListener(
  "keydown",
  (e) => {
    if (isTyping()) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // 0-9 seek
    if (e.key >= "0" && e.key <= "9" && !e.shiftKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      seekToPercent(parseInt(e.key) / 10);
      return;
    }

    switch (e.key) {
      case " ":
        e.preventDefault();
        e.stopImmediatePropagation();
        playPause();
        break;
      case "n":
      case "N":
        e.preventDefault();
        e.stopImmediatePropagation();
        next();
        break;
      case "b":
      case "B":
        e.preventDefault();
        e.stopImmediatePropagation();
        prev();
        break;
      case "l":
      case "L":
        e.preventDefault();
        e.stopImmediatePropagation();
        loop();
        break;
      case "p":
        e.preventDefault();
        e.stopImmediatePropagation();
        playPlaylistPage();
        break;
      case "ArrowLeft":
        e.preventDefault();
        e.stopImmediatePropagation();
        seekBy(-5);
        showToast(
          `⏪ ${formatTime(document.querySelector("video")?.currentTime ?? 0)}`,
        );
        break;
      case "ArrowRight":
        e.preventDefault();
        e.stopImmediatePropagation();
        seekBy(5);
        showToast(
          `⏩ ${formatTime(document.querySelector("video")?.currentTime ?? 0)}`,
        );
        break;
      case "/":
        e.preventDefault();
        e.stopImmediatePropagation();
        window.ytmPalette?.open();
        break;
      case "Backspace":
        e.preventDefault();
        e.stopImmediatePropagation();
        goBack();
        break;
      case "-":
        e.preventDefault();
        e.stopImmediatePropagation();
        changeVol(-0.05);
        break;
      case "=":
        e.preventDefault();
        e.stopImmediatePropagation();
        changeVol(0.05);
        break;
    }
  },
  true,
);

// ── Add to playlist: Shift+P ──────────────────────────────────────────────────
function addToPlaylist() {
  const bar = getBar();
  if (!bar) return;

  const menuBtn =
    bar.querySelector("ytmusic-menu-renderer yt-button-shape button") ||
    bar.querySelector('[aria-label="More options"]') ||
    bar.querySelector('[aria-label="Menu"]') ||
    bar.querySelector("ytmusic-menu-renderer button");

  if (!menuBtn) return;
  menuBtn.click();

  setTimeout(() => {
    const items = document.querySelectorAll(
      "tp-yt-paper-listbox yt-list-item-view, " +
        "ytmusic-menu-popup-renderer yt-list-item-view, " +
        "tp-yt-paper-item, " +
        "ytmusic-popup-container yt-formatted-string",
    );
    for (const item of items) {
      const text = (item.innerText || item.textContent || "").toLowerCase();
      if (
        text.includes("save to playlist") ||
        text.includes("add to playlist") ||
        text.includes("save to library")
      ) {
        item.click();
        return;
      }
    }
    const popupBtns = document.querySelectorAll(
      "ytmusic-popup-container [aria-label]",
    );
    for (const btn of popupBtns) {
      const label = (btn.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("playlist") || label.includes("save")) {
        btn.click();
        return;
      }
    }
  }, 300);
}

document.addEventListener(
  "keydown",
  (e) => {
    if (isTyping()) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.shiftKey && (e.key === "p" || e.key === "P")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      addToPlaylist();
    }
  },
  true,
);

// ── Ctrl+/ shortcuts popout ───────────────────────────────────────────────────
function createShortcutsPopout() {
  if (document.getElementById("ytm-shortcuts-popout")) {
    document.getElementById("ytm-shortcuts-popout").remove();
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "ytm-shortcuts-popout";
  overlay.innerHTML = `
    <style>
      #ytm-shortcuts-popout {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(24, 25, 38, 0.85);
        backdrop-filter: blur(6px);
        font-family: 'YouTube Sans', sans-serif;
        animation: ytm-fadein 0.15s ease;
      }
      @keyframes ytm-fadein {
        from { opacity: 0; transform: scale(0.97); }
        to   { opacity: 1; transform: scale(1); }
      }
      #ytm-shortcuts-box {
        background: #1e2030;
        border: 1px solid #494d64;
        border-radius: 16px;
        padding: 28px 36px;
        min-width: 420px;
        max-width: 540px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      }
      #ytm-shortcuts-box h2 {
        color: #c6a0f6;
        margin: 0 0 20px 0;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #ytm-shortcuts-box h2 span.badge {
        background: #363a4f;
        color: #8aadf4;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 20px;
        letter-spacing: 0.06em;
        font-weight: 600;
      }
      .ytm-shortcut-section { margin-bottom: 18px; }
      .ytm-shortcut-section-title {
        color: #6e738d;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
        font-weight: 600;
      }
      .ytm-shortcut-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 0;
        border-bottom: 1px solid #363a4f;
        gap: 16px;
      }
      .ytm-shortcut-row:last-child { border-bottom: none; }
      .ytm-shortcut-desc { color: #cad3f5; font-size: 13.5px; }
      .ytm-shortcut-keys { display: flex; gap: 5px; flex-shrink: 0; }
      .ytm-key {
        background: #363a4f;
        color: #b7bdf8;
        border: 1px solid #494d64;
        border-radius: 6px;
        padding: 2px 9px;
        font-size: 12px;
        font-family: monospace;
        font-weight: 600;
        box-shadow: 0 2px 0 #24273a;
      }
      #ytm-shortcuts-close {
        float: right;
        background: none;
        border: none;
        color: #6e738d;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        margin-top: -2px;
      }
      #ytm-shortcuts-close:hover { color: #cad3f5; }
      .ytm-shortcut-hint {
        color: #6e738d;
        font-size: 11.5px;
        text-align: center;
        margin-top: 18px;
      }
    </style>
    <div id="ytm-shortcuts-box">
      <h2>
        ⌨ Shortcuts
        <span class="badge">YTM Extension</span>
        <button id="ytm-shortcuts-close">✕</button>
      </h2>

      <div class="ytm-shortcut-section">
        <div class="ytm-shortcut-section-title">Playback</div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Play / Pause</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">Space</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Previous song</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">B</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Next song</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">N</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Toggle loop</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">L</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Play playlist page</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">P</kbd></span></div>
      </div>

      <div class="ytm-shortcut-section">
        <div class="ytm-shortcut-section-title">Seek & Volume</div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Seek back 5s</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">←</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Seek forward 5s</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">→</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Seek to position</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">0</kbd> – <kbd class="ytm-key">9</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Volume up / down</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">=</kbd><kbd class="ytm-key">-</kbd></span></div>
      </div>

      <div class="ytm-shortcut-section">
        <div class="ytm-shortcut-section-title">Library</div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Add to playlist</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">Shift</kbd><kbd class="ytm-key">P</kbd></span></div>
      </div>

      <div class="ytm-shortcut-section">
        <div class="ytm-shortcut-section-title">Navigation</div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Go back</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">Backspace</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Open palette</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">/</kbd></span></div>
        <div class="ytm-shortcut-row"><span class="ytm-shortcut-desc">Show / hide shortcuts</span><span class="ytm-shortcut-keys"><kbd class="ytm-key">Ctrl</kbd><kbd class="ytm-key">/</kbd></span></div>
      </div>

      <div class="ytm-shortcut-hint">Press <strong>Ctrl+/</strong> or <strong>Esc</strong> to close</div>
    </div>
  `;

  document.body.appendChild(overlay);
  document
    .getElementById("ytm-shortcuts-close")
    .addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  const escHandler = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", escHandler, true);
    }
  };
  document.addEventListener("keydown", escHandler, true);
}

document.addEventListener(
  "keydown",
  (e) => {
    if (e.ctrlKey && e.key === "/") {
      e.preventDefault();
      e.stopImmediatePropagation();
      createShortcutsPopout();
    }
  },
  true,
);
