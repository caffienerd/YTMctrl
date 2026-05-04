// features/palette.js — VSCode-style command palette for YTM
// Depends on: core/debug.js, core/dom.js, core/network.js
//
// Alt+/  = open / close
// /query = filter playlists  (/ → drill into songs, Enter → open playlist)
// song mode: Enter → play, Backspace/Esc → back

(function () {
  const { escHtml, highlight, thumbHtml, fuzzy, score } = ytmDom;
  const { fetchPlaylists, fetchSongs, fetchSuggestions } = ytmNet;

  let paletteOpen = false;
  let activeIndex = 0;
  let currentResults = [];
  let mode = "search"; // "search" | "playlist" | "song"
  let lockedPlaylist = null;
  let suggestTimer = null;

  // ── Quick-nav items ──────────────────────────────────────────────────────────
  // SVG paths match the Material icons YTM uses in its own sidebar.
  const _SVG = {
    home: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
    explore: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93V18h2v1.93c-3.95-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6zm6.9-2.54-4.55-2.27-2.27-4.55 6.82-2.27-2 9.09zM12 4.07V6h-2V4.07c3.95.49 7 3.85 7 7.93h-2c0-3.31-2.69-6-6-6z"/></svg>`,
    library: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>`,
    newpl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
  };

  // NAV_ITEMS — shown only on the idle (empty-query) search screen.
  // Not shown in playlist `/` mode.
  const NAV_ITEMS = [
    {
      label: "Home",
      svgKey: "home",
      browseId: "FEmusic_home",
      url: "https://music.youtube.com/",
      action: "browse",
    },
    {
      label: "Explore",
      svgKey: "explore",
      browseId: "FEmusic_explore",
      url: "https://music.youtube.com/explore",
      action: "browse",
    },
    {
      label: "Library",
      svgKey: "library",
      browseId: "FEmusic_liked_playlists",
      url: "https://music.youtube.com/library",
      action: "browse",
    },
    { label: "New playlist", svgKey: "newpl", action: "newpl" },
  ];

  function activateNavItem(item) {
    closePalette();
    if (item.action === "newpl") {
      // Trigger YTM's own "new playlist" flow via its menu button if present,
      // otherwise navigate to library where the button lives.
      const btn = document.querySelector(
        "ytmusic-guide-entry-renderer a[href*='new_playlist'], [aria-label*='new playlist' i]",
      );
      if (btn) btn.click();
      else {
        window.onbeforeunload = null;
        location.href = "https://music.youtube.com/library";
      }
      return;
    }
    const ok = _dispatch({
      endpoint: { browseEndpoint: { browseId: item.browseId } },
    });
    if (!ok) {
      window.onbeforeunload = null;
      location.href = item.url;
    }
  }

  function navItemHtml(item, i, active) {
    return `<div class="ytm-pal-item ytm-pal-item--nav${active ? " active" : ""}" data-i="${i}">
      <div class="ytm-pal-thumb-ph ytm-pal-nav-icon">${_SVG[item.svgKey]}</div>
      <div class="ytm-pal-info">
        <span class="ytm-pal-title">${escHtml(item.label)}</span>
      </div>
    </div>`;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  function _dispatch(detail) {
    return document.querySelector("ytmusic-app")?.dispatchEvent(
      new CustomEvent("yt-navigate", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  function playSong(videoId, playlistId) {
    closePalette();
    window._ytmPaletteNavigating = true;
    setTimeout(() => {
      window._ytmPaletteNavigating = false;
    }, 2000);

    const ok = _dispatch({
      endpoint: {
        watchEndpoint: {
          videoId,
          ...(playlistId ? { playlistId } : {}),
          params:
            "OAFqJQoJRkVtdXNpY19ob21lEhBGRW11c2ljX2xpa2VkX3BsYXlsaXN0cw%3D%3D",
        },
      },
    });
    if (!ok)
      location.href = `/watch?v=${videoId}${playlistId ? `&list=${playlistId}` : ""}`;
  }

  function ytmGo(path, playlistId) {
    closePalette();
    let detail;
    if (playlistId) {
      detail = {
        endpoint: {
          browseEndpoint: {
            browseId: "VL" + playlistId,
            browseEndpointContextSupportedConfigs: {
              browseEndpointContextMusicConfig: {
                pageType: "MUSIC_PAGE_TYPE_PLAYLIST",
              },
            },
          },
        },
      };
    } else {
      const q = new URLSearchParams(path.split("?")[1] ?? "").get("q") ?? "";
      detail = { endpoint: { searchEndpoint: { query: q, params: "" } } };
    }
    if (!_dispatch(detail)) {
      window.onbeforeunload = null;
      location.href = path;
    }
  }

  function ytmBrowse(browseId) {
    closePalette();
    _dispatch({ endpoint: { browseEndpoint: { browseId } } });
  }

  function activateSuggestion(s) {
    if (s.type === "query") ytmGo(`/search?q=${encodeURIComponent(s.query)}`);
    else if (s.videoId) playSong(s.videoId, null);
    else if (s.browseId) ytmBrowse(s.browseId);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function renderItems(items, tplFn, onActivate) {
    const el = document.getElementById("ytm-pal-results");
    activeIndex = 0;
    if (!items.length) {
      el.innerHTML = `<div class="ytm-pal-empty">No results</div>`;
      return;
    }
    el.innerHTML = items
      .map(
        (item, i) =>
          `<div class="ytm-pal-item${i === 0 ? " active" : ""}" data-i="${i}">${tplFn(item, i)}</div>`,
      )
      .join("");
    el.querySelectorAll(".ytm-pal-item").forEach((row, i) => {
      row.addEventListener("mouseenter", () => setActive(i));
      row.addEventListener("click", () => onActivate(items[i]));
    });
  }

  function setActive(i) {
    activeIndex = i;
    const rows = document.querySelectorAll(".ytm-pal-item");
    rows.forEach((r, idx) => r.classList.toggle("active", idx === i));
    rows[i]?.scrollIntoView({ block: "nearest" });
  }

  function setModeLabel(text) {
    const el = document.getElementById("ytm-pal-mode");
    if (el) el.textContent = `— ${text}`;
  }

  function showCrumb(pl) {
    const crumb = document.getElementById("ytm-pal-crumb");
    const pill = document.getElementById("ytm-pal-crumb-pill");
    if (!crumb || !pill) return;
    pill.innerHTML =
      (pl.thumb ? `<img src="${pl.thumb}" />` : "") + escHtml(pl.title);
    crumb.classList.add("visible");
  }
  function hideCrumb() {
    document.getElementById("ytm-pal-crumb")?.classList.remove("visible");
  }

  // ── Suggestions (debounced) ─────────────────────────────────────────────────
  function scheduleSuggestions(raw) {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(async () => {
      if (mode !== "search" || !raw.trim()) return;
      const resultsEl = document.getElementById("ytm-pal-results");
      if (!resultsEl) return;
      const suggestions = await fetchSuggestions(raw.trim());
      if (mode !== "search" || !suggestions.length) return;

      currentResults = suggestions;
      setModeLabel("suggestions");

      resultsEl.innerHTML = suggestions
        .map((s, i) => {
          if (s.type === "query") {
            return `<div class="ytm-pal-item${i === 0 ? " active" : ""}" data-i="${i}">
            <div class="ytm-pal-thumb-ph" style="font-size:13px">🔍</div>
            <div class="ytm-pal-info"><span class="ytm-pal-title">${s.html}</span></div>
          </div>`;
          }
          return `<div class="ytm-pal-item${i === 0 ? " active" : ""}" data-i="${i}">
          ${thumbHtml(s.thumb)}
          <div class="ytm-pal-info">
            <span class="ytm-pal-title">${escHtml(s.title)}</span>
            <span class="ytm-pal-sub">${escHtml(s.artist)}</span>
          </div>
        </div>`;
        })
        .join("");

      resultsEl.querySelectorAll(".ytm-pal-item").forEach((row, i) => {
        row.addEventListener("mouseenter", () => setActive(i));
        row.addEventListener("click", () => activateSuggestion(suggestions[i]));
      });
    }, 200);
  }

  // ── Core update ─────────────────────────────────────────────────────────────
  async function updatePalette(raw) {
    const resultsEl = document.getElementById("ytm-pal-results");

    // Song mode
    if (mode === "song") {
      const q = raw.trim();
      setModeLabel(`songs in "${lockedPlaylist.title}"`);
      let songs = await fetchSongs(lockedPlaylist.playlistId);
      if (!songs.length) {
        resultsEl.innerHTML = `<div class="ytm-pal-empty">Couldn't load songs.</div>`;
        return;
      }
      currentResults = songs
        .filter((s) => !q || fuzzy(s.title + " " + s.artist, q))
        .sort(
          (a, b) =>
            score(b.title, q) +
            score(b.artist, q) -
            (score(a.title, q) + score(a.artist, q)),
        );

      renderItems(
        currentResults,
        (s, i) => `
          ${
            s.thumb
              ? `<img class="ytm-pal-thumb" src="${s.thumb}" />`
              : `<div class="ytm-pal-thumb-ph" style="font-size:11px;color:#494d64">${i + 1}</div>`
          }
          <div class="ytm-pal-info">
            <span class="ytm-pal-title">${highlight(s.title, q)}</span>
            <span class="ytm-pal-sub">${highlight(s.artist, q)}</span>
          </div>`,
        (s) => playSong(s.videoId, lockedPlaylist.playlistId),
      );
      return;
    }

    // Playlist mode
    if (raw.startsWith("/")) {
      if (mode !== "playlist") {
        mode = "playlist";
        hideCrumb();
      }
      const q = raw.slice(1).trim();
      setModeLabel("playlists  ·  / → songs");
      if (!resultsEl.querySelector(".ytm-pal-item")) {
        resultsEl.innerHTML = `<div class="ytm-pal-empty" style="color:#8087a2">Loading…</div>`;
      }
      const playlists = await fetchPlaylists();
      if (!playlists.length) {
        resultsEl.innerHTML = `<div class="ytm-pal-empty">Couldn't load playlists — are you logged in?</div>`;
        return;
      }
      currentResults = playlists
        .filter((p) => !q || fuzzy(p.title + " " + p.subtitle, q))
        .sort(
          (a, b) =>
            score(b.title, q) +
            score(b.subtitle, q) -
            (score(a.title, q) + score(a.subtitle, q)),
        );
      renderItems(
        currentResults,
        (p) => `
          ${thumbHtml(p.thumb)}
          <div class="ytm-pal-info">
            <span class="ytm-pal-title">${highlight(p.title, q)}</span>
            <span class="ytm-pal-sub">${escHtml(p.subtitle) || "Playlist"}</span>
          </div>`,
        (p) => ytmGo(p.href, p.playlistId),
      );
      return;
    }

    // Search mode
    mode = "search";
    hideCrumb();
    currentResults = [];

    if (!raw.trim()) {
      setModeLabel("search");
      currentResults = NAV_ITEMS.map((item) => ({ ...item, _nav: true }));
      resultsEl.innerHTML =
        `<div class="ytm-pal-empty" style="padding-bottom:8px">
          Type to search &nbsp;·&nbsp; <strong style="color:#c6a0f6">/</strong> for playlists
        </div>` +
        NAV_ITEMS.map((item, i) => navItemHtml(item, i, i === 0)).join("");
      activeIndex = 0;
      resultsEl.querySelectorAll(".ytm-pal-item").forEach((row, i) => {
        row.addEventListener("mouseenter", () => setActive(i));
        row.addEventListener("click", () => activateNavItem(NAV_ITEMS[i]));
      });
      return;
    }

    setModeLabel("search");
    resultsEl.innerHTML = `<div class="ytm-pal-empty" style="color:#8087a2">
      Press <strong style="color:#cad3f5">Enter</strong> to search for
      "<strong style="color:#cad3f5">${escHtml(raw)}</strong>"
    </div>`;
    scheduleSuggestions(raw);
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────
  function handleKey(e) {
    const input = document.getElementById("ytm-pal-input");

    if (e.key === "Escape") {
      e.stopImmediatePropagation();
      mode === "song" ? exitSongMode() : closePalette();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, currentResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
      return;
    }
    if (e.key === "/" && mode === "playlist" && currentResults.length) {
      e.preventDefault();
      const sel = currentResults[activeIndex];
      if (!sel._nav) enterSongMode(sel);
      return;
    }
    if (e.key === "Backspace" && mode === "song" && input.value === "") {
      exitSongMode();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "song" && currentResults.length) {
        playSong(
          currentResults[activeIndex].videoId,
          lockedPlaylist.playlistId,
        );
        return;
      }
      if (mode === "playlist" && currentResults.length) {
        ytmGo(
          currentResults[activeIndex].href,
          currentResults[activeIndex].playlistId,
        );
        return;
      }
      if (mode === "search") {
        if (currentResults.length && currentResults[activeIndex]) {
          const sel = currentResults[activeIndex];
          if (sel._nav) {
            activateNavItem(sel);
            return;
          }
          activateSuggestion(sel);
          return;
        }
        if (input.value.trim())
          ytmGo(`/search?q=${encodeURIComponent(input.value.trim())}`);
      }
    }
  }

  function enterSongMode(playlist) {
    lockedPlaylist = playlist;
    mode = "song";
    const input = document.getElementById("ytm-pal-input");
    input.value = "";
    input.placeholder = `Search in "${playlist.title}"…`;
    showCrumb(playlist);
    fetchSongs(playlist.playlistId); // prefetch into cache
    updatePalette("");
  }

  function exitSongMode() {
    lockedPlaylist = null;
    mode = "playlist";
    const input = document.getElementById("ytm-pal-input");
    input.value = "/";
    input.placeholder = "Search YTM… or /playlist name";
    hideCrumb();
    updatePalette("/");
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────
  function buildPalette() {
    if (document.getElementById("ytm-palette")) return;
    const el = document.createElement("div");
    el.id = "ytm-palette";
    el.innerHTML = `
    <style>
      #ytm-palette {
        position:fixed; inset:0; z-index:999998;
        display:flex; flex-direction:column; align-items:center; padding-top:12vh;
        background:rgba(24,25,38,0.78); backdrop-filter:blur(8px);
        animation:pal-in .12s ease;
      }
      @keyframes pal-in { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      #ytm-pal-box {
        background:#1e2030; border:1px solid #494d64; border-radius:14px;
        width:min(580px,92vw); box-shadow:0 16px 60px rgba(0,0,0,.7); overflow:hidden;
      }
      #ytm-pal-crumb {
        display:none; align-items:center; gap:6px;
        padding:10px 18px 0; font-size:12px; color:#6e738d;
      }
      #ytm-pal-crumb.visible { display:flex; }
      #ytm-pal-crumb-pill {
        background:#363a4f; border:1px solid #494d64; border-radius:20px;
        padding:2px 10px 2px 6px; color:#c6a0f6; font-size:12px; font-weight:600;
        display:flex; align-items:center; gap:5px;
      }
      #ytm-pal-crumb-pill img { width:16px; height:16px; border-radius:3px; object-fit:cover; }
      #ytm-pal-crumb-back { color:#494d64; font-size:11px; margin-left:4px; }
      #ytm-pal-input {
        width:100%; box-sizing:border-box; background:transparent; border:none; outline:none;
        color:#cad3f5; font-size:15px; padding:14px 18px;
        font-family:'YouTube Sans',sans-serif; caret-color:#c6a0f6;
      }
      #ytm-pal-input::placeholder { color:#5b6078; }
      #ytm-pal-divider { height:1px; background:#363a4f; }
      #ytm-pal-mode { padding:5px 18px 6px; font-size:11px; color:#6e738d; font-family:monospace; letter-spacing:.05em; }
      #ytm-pal-results { max-height:340px; overflow-y:auto; scrollbar-width:none; }
      .ytm-pal-item {
        display:flex; align-items:center; gap:12px; padding:8px 16px; cursor:pointer;
        border-left:3px solid transparent;
      }
      .ytm-pal-item:hover  { background:#2d3047; }
      .ytm-pal-item.active { background:#363a4f; border-left-color:#c6a0f6; padding-left:13px; }
      .ytm-pal-thumb { width:38px; height:38px; border-radius:5px; object-fit:cover; flex-shrink:0; background:#363a4f; }
      .ytm-pal-thumb-ph {
        width:38px; height:38px; border-radius:5px; background:#363a4f;
        display:flex; align-items:center; justify-content:center;
        color:#5b6078; font-size:16px; flex-shrink:0;
      }
      .ytm-pal-info { display:flex; flex-direction:column; gap:1px; min-width:0; }
      .ytm-pal-title { color:#cad3f5; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .ytm-pal-sub   { color:#6e738d; font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .ytm-pal-nav-icon svg { width:18px; height:18px; color:#8087a2; }
      .ytm-pal-item--nav:hover .ytm-pal-nav-icon svg,
      .ytm-pal-item--nav.active .ytm-pal-nav-icon svg { color:#c6a0f6; }
      .ytm-pal-item--nav .ytm-pal-thumb-ph { background:transparent; border-radius:0; }
      .ytm-pal-empty { color:#5b6078; font-size:13px; padding:20px 16px; text-align:center; }
      #ytm-pal-footer {
        padding:7px 16px; border-top:1px solid #363a4f;
        display:flex; gap:14px; font-size:11px; color:#5b6078; flex-wrap:wrap;
      }
      #ytm-pal-footer kbd {
        background:#363a4f; border:1px solid #494d64; border-radius:4px;
        padding:1px 5px; font-family:monospace; color:#8087a2; font-size:11px;
      }
    </style>
    <div id="ytm-pal-box">
      <div id="ytm-pal-crumb">
        in&nbsp;<div id="ytm-pal-crumb-pill"></div>
        <span id="ytm-pal-crumb-back">— / or Esc to go back</span>
      </div>
      <input id="ytm-pal-input" placeholder="Search YTM… or /playlist name" autocomplete="off" spellcheck="false" />
      <div id="ytm-pal-divider"></div>
      <div id="ytm-pal-mode">— search</div>
      <div id="ytm-pal-results"></div>
      <div id="ytm-pal-footer">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>/</kbd> drill into playlist</span>
        <span><kbd>Esc</kbd> back / close</span>
      </div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      if (e.target === el) closePalette();
    });
    document
      .getElementById("ytm-pal-input")
      .addEventListener("input", (e) => updatePalette(e.target.value));
    document
      .getElementById("ytm-pal-input")
      .addEventListener("keydown", handleKey);
  }

  // ── Open / close ────────────────────────────────────────────────────────────
  function openPalette() {
    paletteOpen = true;
    mode = "search";
    lockedPlaylist = null;
    buildPalette();
    const input = document.getElementById("ytm-pal-input");
    input.value = "";
    input.placeholder = "Search YTM… or /playlist name";
    hideCrumb();
    updatePalette("");
    setTimeout(() => input.focus(), 30);
  }
  function closePalette() {
    paletteOpen = false;
    clearTimeout(suggestTimer);
    document.getElementById("ytm-palette")?.remove();
  }

  // ── Trigger: Alt+/ ──────────────────────────────────────────────────────────
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && e.key === "/") {
        e.preventDefault();
        e.stopImmediatePropagation();
        paletteOpen ? closePalette() : openPalette();
      }
    },
    true,
  );

  window.ytmPalette = {
    open: openPalette,
    close: closePalette,
    clearCache: () => ytmNet.clearCache(),
  };

  ytmLog.info("palette.js ready");
})();
