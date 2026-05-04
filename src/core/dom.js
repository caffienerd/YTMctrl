// core/dom.js — shared DOM + string utilities
// Exposes: window.ytmDom
// Depends on: core/debug.js

(function () {
  function getBar() {
    return document.querySelector("ytmusic-player-bar");
  }
  function getVideo() {
    return document.querySelector("video");
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

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlight(str, q) {
    if (!q) return escHtml(str);
    const s = escHtml(str);
    const eq = escHtml(q.trim());
    if (!eq) return s;
    return s.replace(
      new RegExp(`(${eq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
      '<strong style="color:#c6a0f6">$1</strong>',
    );
  }

  function fuzzy(str, q) {
    str = str.toLowerCase();
    q = q.toLowerCase().trim();
    if (!q) return true;
    let i = 0;
    for (const ch of q) {
      i = str.indexOf(ch, i);
      if (i < 0) return false;
      i++;
    }
    return true;
  }

  function score(str, q) {
    str = str.toLowerCase();
    q = q.toLowerCase().trim();
    if (!q) return 0;
    if (str.startsWith(q)) return 3;
    if (str.includes(q)) return 2;
    if (fuzzy(str, q)) return 1;
    return 0;
  }

  function thumbHtml(url, fallback = "🎵") {
    return url
      ? `<img class="ytm-pal-thumb" src="${url}" />`
      : `<div class="ytm-pal-thumb-ph">${fallback}</div>`;
  }

  window.ytmDom = {
    getBar,
    getVideo,
    findBtn,
    isTyping,
    escHtml,
    highlight,
    fuzzy,
    score,
    thumbHtml,
  };

  ytmLog.info("dom.js ready");
})();
