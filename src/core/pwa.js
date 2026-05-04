// core/pwa.js — override YTM's web app manifest so the PWA gets our icon
// and name instead of Google's defaults. Runs at document_start.

(function () {
  "use strict";

  function injectManifest() {
    const r = (path) => chrome.runtime.getURL(path);
    const manifest = {
      name: "YTM",
      short_name: "YTM",
      description: "YouTube Music — Catppuccin Macchiato",
      start_url: "https://music.youtube.com/",
      scope: "https://music.youtube.com/",
      display: "standalone",
      background_color: "#24273a",
      theme_color: "#24273a",
      icons: [
        { src: r("icon/pwa/icon16.png"), sizes: "16x16", type: "image/png" },
        { src: r("icon/pwa/icon48.png"), sizes: "48x48", type: "image/png" },
        { src: r("icon/pwa/icon128.png"), sizes: "128x128", type: "image/png" },
        {
          src: r("icon/pwa/icon192.png"),
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: r("icon/pwa/icon512.png"),
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], {
      type: "application/manifest+json",
    });
    const blobUrl = URL.createObjectURL(blob);

    document
      .querySelectorAll('link[rel="manifest"]')
      .forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = blobUrl;
    (document.head ?? document.documentElement).appendChild(link);

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      (document.head ?? document.documentElement).appendChild(themeMeta);
    }
    themeMeta.content = "#24273a";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectManifest, {
      once: true,
    });
  } else {
    injectManifest();
  }

  const _pushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    _pushState(...args);
    injectManifest();
  };
})();
