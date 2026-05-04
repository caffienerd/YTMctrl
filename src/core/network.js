// core/network.js — YTM internal API + caching
// Exposes: window.ytmNet
// Depends on: core/debug.js
//
// Cache strategy:
//   playlists → chrome.storage.local (persists across restarts, 1hr TTL)
//   songs     → in-memory Map (lives as long as the content script = tab lifetime)

(function () {
  const PLAYLIST_TTL = 60 * 60 * 1000;
  const KEY_PLAYLISTS = "ytmnet_playlists";

  // ── Auth ──────────────────────────────────────────────────────────────────
  async function sapisidHash() {
    let sid = null;
    for (const name of ["__Secure-3PAPISID", "SAPISID"]) {
      const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
      if (m) {
        sid = m[1];
        break;
      }
    }
    if (!sid) return null;
    const ts = Math.floor(Date.now() / 1000);
    const buf = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(`${ts} ${sid} https://music.youtube.com`),
    );
    const hex = [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `SAPISIDHASH ${ts}_${hex}`;
  }

  function getApiKey() {
    const m = document.documentElement.innerHTML.match(
      /"INNERTUBE_API_KEY":"([^"]+)"/,
    );
    return m?.[1] ?? "AIzaSyC9XL3ZjWddXya6X74dJoCTL-NKNELL6imA";
  }

  const CLIENT_CTX = {
    context: {
      client: {
        clientName: "WEB_REMIX",
        clientVersion: "1.20240101.01.00",
        hl: "en",
      },
    },
  };

  async function ytmFetch(endpoint, body) {
    const auth = await sapisidHash();
    if (!auth) return null;
    try {
      const res = await fetch(
        `https://music.youtube.com/youtubei/v1/${endpoint}?key=${getApiKey()}&prettyPrint=false`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth,
            "X-Origin": "https://music.youtube.com",
          },
          body: JSON.stringify({ ...body, ...CLIENT_CTX }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      ytmLog.warn(`ytmFetch(${endpoint}) error:`, e);
      return null;
    }
  }

  // ── chrome.storage.local helper (playlists only) ──────────────────────────
  function localGet(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(key, (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(res[key] ?? null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }
  function localSet(key, value) {
    try {
      chrome.storage.local.set({ [key]: value });
    } catch (e) {
      ytmLog.warn("localSet failed:", e);
    }
  }

  // ── Playlists — persisted ─────────────────────────────────────────────────
  let _playlistMem = null;

  async function fetchPlaylists() {
    if (_playlistMem) return _playlistMem;

    const cached = await localGet(KEY_PLAYLISTS);
    if (cached && Date.now() - cached.ts < PLAYLIST_TTL) {
      ytmLog.log(`playlists: cache hit (${cached.data.length})`);
      _playlistMem = cached.data;
      return cached.data;
    }

    ytmLog.log("playlists: fetching…");
    const data = await ytmFetch("browse", {
      browseId: "FEmusic_liked_playlists",
    });
    if (!data) return [];

    const results = [];
    const seen = new Set();
    function walk(obj) {
      if (!obj || typeof obj !== "object") return;
      if (obj.musicTwoRowItemRenderer) {
        const r = obj.musicTwoRowItemRenderer;
        const title = r.title?.runs?.[0]?.text ?? "";
        const subtitle = r.subtitle?.runs?.map((x) => x.text).join("") ?? "";
        const thumb = (
          r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(
            -1,
          )?.url ??
          r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)
            ?.url ??
          ""
        ).replace(/=w\d+-h\d+/, "=w56-h56");
        const bid = r.navigationEndpoint?.browseEndpoint?.browseId ?? "";
        const pid = bid.startsWith("VL") ? bid.slice(2) : bid;
        if (title && pid && !seen.has(pid)) {
          seen.add(pid);
          results.push({
            title,
            subtitle,
            playlistId: pid,
            thumb,
            href: `/playlist?list=${pid}`,
          });
        }
      }
      if (Array.isArray(obj)) obj.forEach(walk);
      else Object.values(obj).forEach(walk);
    }
    walk(data);

    if (results.length) {
      _playlistMem = results;
      localSet(KEY_PLAYLISTS, { ts: Date.now(), data: results });
      ytmLog.log(`playlists: fetched & cached ${results.length}`);
    }
    return results;
  }

  // ── Songs — in-memory only (tab lifetime is enough) ───────────────────────
  const _songMem = new Map();

  async function fetchSongs(playlistId) {
    if (_songMem.has(playlistId)) {
      ytmLog.log(`songs[${playlistId}]: mem hit`);
      return _songMem.get(playlistId);
    }

    ytmLog.log(`songs[${playlistId}]: fetching…`);
    const data = await ytmFetch("browse", { browseId: "VL" + playlistId });
    if (!data) return [];

    const songs = [];
    const seen = new Set();
    function walk(obj) {
      if (!obj || typeof obj !== "object") return;
      if (obj.musicResponsiveListItemRenderer) {
        const r = obj.musicResponsiveListItemRenderer;
        const cols = r.flexColumns ?? [];
        const title =
          cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
            ?.text ?? "";
        const artist =
          cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
            ?.text ?? "";
        const vid =
          r.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
            ?.videoId ??
          cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
            ?.navigationEndpoint?.watchEndpoint?.videoId ??
          "";
        const thumb = (
          r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)
            ?.url ??
          r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(
            -1,
          )?.url ??
          ""
        ).replace(/=w\d+-h\d+/, "=w56-h56");
        if (title && vid && !seen.has(vid)) {
          seen.add(vid);
          songs.push({ title, artist, videoId: vid, thumb });
        }
      }
      if (Array.isArray(obj)) obj.forEach(walk);
      else Object.values(obj).forEach(walk);
    }
    walk(data);

    _songMem.set(playlistId, songs);
    ytmLog.log(`songs[${playlistId}]: fetched ${songs.length}`);
    return songs;
  }

  // ── Suggestions — never cached, always fresh ──────────────────────────────
  function _esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function fetchSuggestions(input) {
    const data = await ytmFetch("music/get_search_suggestions", { input });
    if (!data) return [];
    const results = [];
    for (const section of data?.contents ?? []) {
      const contents =
        section?.searchSuggestionsSectionRenderer?.contents ?? [];
      for (const item of contents) {
        if (item.searchSuggestionRenderer) {
          const r = item.searchSuggestionRenderer;
          const query = r.navigationEndpoint?.searchEndpoint?.query ?? "";
          const html = (r.suggestion?.runs ?? [])
            .map((run) =>
              run.bold
                ? `<span style="color:#6e738d">${_esc(run.text)}</span>`
                : `<span style="color:#cad3f5">${_esc(run.text)}</span>`,
            )
            .join("");
          if (query) results.push({ type: "query", query, html });
        }
        if (item.musicResponsiveListItemRenderer) {
          const r = item.musicResponsiveListItemRenderer;
          const cols = r.flexColumns ?? [];
          const title =
            cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
              ?.text ?? "";
          const artist = (
            cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []
          )
            .map((x) => x.text)
            .join("");
          const videoId =
            r.overlay?.musicItemThumbnailOverlayRenderer?.content
              ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
              ?.videoId ??
            r.navigationEndpoint?.watchEndpoint?.videoId ??
            "";
          const browseId = !videoId
            ? (r.navigationEndpoint?.browseEndpoint?.browseId ?? "")
            : "";
          const thumb = (
            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)
              ?.url ?? ""
          ).replace(/=w\d+-h\d+/, "=w56-h56");
          if (title)
            results.push({
              type: "song",
              title,
              artist,
              videoId,
              browseId,
              thumb,
            });
        }
      }
    }
    return results;
  }

  // ── Public ────────────────────────────────────────────────────────────────
  window.ytmNet = {
    fetchPlaylists,
    fetchSongs,
    fetchSuggestions,
    clearCache() {
      _playlistMem = null;
      _songMem.clear();
      try {
        chrome.storage.local.remove(KEY_PLAYLISTS);
      } catch (e) {}
      ytmLog.log("cache cleared");
    },
  };

  ytmLog.info("network.js ready");
})();
