// core/loader.js — early loading screen injected at document_start
// Runs BEFORE the page parses anything — gives instant visual feedback.
// Self-destructs once ytmusic-app is in the DOM.

(function () {
  "use strict";

  const style = document.createElement("style");
  style.id = "ytm-loader-style";
  style.textContent = `
    #ytm-loader {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #24273a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 28px;
      font-family: "YouTube Sans", "Roboto", sans-serif;
      transition: opacity 0.35s ease, visibility 0.35s ease;
    }
    #ytm-loader.ytm-loader--hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .ytm-loader__ring {
      position: relative;
      width: 96px;
      height: 96px;
    }
    .ytm-loader__ring::before,
    .ytm-loader__ring::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2.5px solid transparent;
    }
    .ytm-loader__ring::before {
      border-top-color: #c6a0f6;
      border-right-color: #c6a0f640;
      animation: ytm-spin 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    .ytm-loader__ring::after {
      inset: 8px;
      border-bottom-color: #ff0000cc;
      border-left-color: #ff000030;
      animation: ytm-spin 0.85s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse;
    }
    .ytm-loader__icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ytm-pulse 2s ease-in-out infinite;
    }
    .ytm-loader__icon svg {
      width: 44px;
      height: 44px;
    }
    .ytm-loader__label {
      color: #a5adcb;
      font-size: 13px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      animation: ytm-blink 1.6s ease-in-out infinite;
    }
    .ytm-loader__bar {
      position: fixed;
      bottom: 0;
      left: 0;
      height: 2px;
      width: 0%;
      background: linear-gradient(90deg, #c6a0f6, #ff0000);
      border-radius: 0 2px 2px 0;
      animation: ytm-progress 2.5s ease-in-out infinite;
    }
    @keyframes ytm-spin    { to { transform: rotate(360deg); } }
    @keyframes ytm-pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(0.92)} }
    @keyframes ytm-blink   { 0%,100%{opacity:0.5} 50%{opacity:1} }
    @keyframes ytm-progress {
      0%  { width:0%;   opacity:1   }
      70% { width:85%;  opacity:1   }
      90% { width:95%;  opacity:0.6 }
      100%{ width:100%; opacity:0   }
    }
  `;

  function mount() {
    document.documentElement.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "ytm-loader";

    const ring = document.createElement("div");
    ring.className = "ytm-loader__ring";

    // Inline SVG — YouTube Music note icon, no external resource needed
    const icon = document.createElement("div");
    icon.className = "ytm-loader__icon";
    icon.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <circle cx="12" cy="12" r="12" fill="#ff0000"/>
      <path d="M10 15.5V8.5l6 1.5v1.5l-4-1v5a2 2 0 1 1-2-1z" fill="#ffffff"/>
    </svg>`;
    ring.appendChild(icon);

    const label = document.createElement("div");
    label.className = "ytm-loader__label";
    label.textContent = "Loading\u2026";

    const bar = document.createElement("div");
    bar.className = "ytm-loader__bar";

    overlay.append(ring, label, bar);
    document.documentElement.appendChild(overlay);
  }

  function dismiss() {
    const overlay = document.getElementById("ytm-loader");
    if (!overlay) return;
    overlay.classList.add("ytm-loader--hidden");
    setTimeout(() => {
      overlay.remove();
      style.remove();
    }, 400);
  }

  function redirectToLibrary(app) {
    app.dispatchEvent(
      new CustomEvent("yt-navigate", {
        bubbles: true,
        detail: {
          endpoint: {
            browseEndpoint: { browseId: "FEmusic_library_landing" },
          },
        },
      }),
    );
  }

  function watchForApp() {
    function onApp() {
      const app = document.querySelector("ytmusic-app");
      if (app) redirectToLibrary(app);
      setTimeout(dismiss, 350);
    }

    const existing = document.querySelector("ytmusic-app");
    if (existing) {
      onApp();
      return;
    }

    const obs = new MutationObserver(() => {
      if (document.querySelector("ytmusic-app")) {
        obs.disconnect();
        onApp();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      dismiss();
    }, 5000);
  }

  if (document.documentElement) {
    mount();
    watchForApp();
  } else {
    new MutationObserver((_, obs) => {
      if (document.documentElement) {
        obs.disconnect();
        mount();
        watchForApp();
      }
    }).observe(document, { childList: true });
  }
})();
