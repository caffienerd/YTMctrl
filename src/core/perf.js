// core/perf.js — safe performance tweaks (v2)
// REMOVED: visibilitychange video pause — it killed music when switching tabs.

(function () {
  "use strict";

  // ── 1. Lazy-load playlist/shelf images (not the player bar) ───────────────
  function applyLazyImages() {
    document.querySelectorAll("img:not([loading])").forEach((img) => {
      if (!img.closest("ytmusic-player-bar")) {
        img.setAttribute("loading", "lazy");
      }
    });
  }
  if ("requestIdleCallback" in window) {
    requestIdleCallback(applyLazyImages, { timeout: 3000 });
  } else {
    setTimeout(applyLazyImages, 2000);
  }

  // ── 2. Auto-dismiss "Are you still there?" ────────────────────────────────
  const dialogObserver = new MutationObserver(() => {
    const dialog = document.querySelector("ytmusic-you-there-renderer");
    if (dialog) {
      const btn = dialog.querySelector("button");
      if (btn) btn.click();
      else dialog.remove();
    }
  });
  dialogObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // ── 3. Strip heavy GPU compositing from non-essential elements ────────────
  const style = document.createElement("style");
  style.textContent = `
    ytmusic-player-page,
    .tp-yt-paper-dialog,
    ytmusic-menu-renderer {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
  `;
  (document.head ?? document.documentElement).appendChild(style);

  // ── 4. Hide "Upgrade" upsell entry in the sidebar guide ──────────────────
  // CSS can't match text content, so we tag the entry with a class that
  // macchiato.css hides via ytmusic-guide-entry-renderer.ytm-hide-upgrade.
  function hideUpgradeEntry() {
    document.querySelectorAll("ytmusic-guide-entry-renderer").forEach((el) => {
      const title = el.querySelector("yt-formatted-string.title");
      if (title?.textContent?.trim() === "Upgrade") {
        el.classList.add("ytm-hide-upgrade");
      }
    });
  }
  const guideObserver = new MutationObserver(hideUpgradeEntry);
  guideObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  hideUpgradeEntry();

  ytmLog?.info("perf.js ready");
})();
