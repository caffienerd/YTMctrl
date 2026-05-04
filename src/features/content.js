// features/console.js — browser console toolkit for YTM debugging & control

(function () {
  const ytm = {
    // ── Playback ──────────────────────────────────────────────────────────────
    play: () => document.querySelector("video")?.play(),
    pause: () => document.querySelector("video")?.pause(),
    next: () =>
      document
        .querySelector('[aria-label="Next"], [aria-label="Next song"]')
        ?.click(),
    prev: () =>
      document
        .querySelector('[aria-label="Previous"], [aria-label="Previous song"]')
        ?.click(),
    seek: (sec) => {
      const v = document.querySelector("video");
      if (v) v.currentTime = sec;
    },
    seekBy: (sec) => {
      const v = document.querySelector("video");
      if (v) v.currentTime += sec;
    },
    vol: (n) => {
      const v = document.querySelector("video");
      if (v) v.volume = Math.min(1, Math.max(0, n));
    },
    mute: () => {
      const v = document.querySelector("video");
      if (v) v.muted = !v.muted;
      return document.querySelector("video")?.muted;
    },

    // ── Now playing info ──────────────────────────────────────────────────────
    nowPlaying() {
      const bar = document.querySelector("ytmusic-player-bar");
      const title = bar?.querySelector(".title")?.innerText;
      const artist = bar?.querySelector(".byline")?.innerText;
      const video = document.querySelector("video");
      return {
        title,
        artist,
        currentTime: video?.currentTime?.toFixed(1),
        duration: video?.duration?.toFixed(1),
        volume: video?.volume?.toFixed(2),
        paused: video?.paused,
        muted: video?.muted,
      };
    },

    // ── Performance snapshot ──────────────────────────────────────────────────
    perf() {
      const nav = performance.getEntriesByType("navigation")[0];
      const paint = Object.fromEntries(
        performance
          .getEntriesByType("paint")
          .map((e) => [e.name, e.startTime.toFixed(0) + "ms"]),
      );
      const mem = performance.memory;
      const result = {
        "Page load (ms)": nav ? nav.loadEventEnd.toFixed(0) : "N/A",
        "DOM interactive (ms)": nav ? nav.domInteractive.toFixed(0) : "N/A",
        "First paint": paint["first-paint"] || "N/A",
        "First contentful paint": paint["first-contentful-paint"] || "N/A",
        "JS heap used (MB)": mem
          ? (mem.usedJSHeapSize / 1048576).toFixed(1)
          : "N/A",
        "JS heap total (MB)": mem
          ? (mem.totalJSHeapSize / 1048576).toFixed(1)
          : "N/A",
      };
      console.table(result);
      return result;
    },

    // ── DOM bloat check ───────────────────────────────────────────────────────
    domStats() {
      const all = document.querySelectorAll("*");
      const counts = {};
      all.forEach((el) => {
        counts[el.tagName] = (counts[el.tagName] || 0) + 1;
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
      console.table(Object.fromEntries(sorted));
      console.log(`Total DOM nodes: ${all.length}`);
      return { total: all.length, top20: Object.fromEntries(sorted) };
    },

    // ── Help ──────────────────────────────────────────────────────────────────
    help() {
      console.log(
        `
%cYTM Fast Toolkit`,
        "color: #c6a0f6; font-size: 16px; font-weight: bold;",
      );
      console.log(
        `%c
Playback: play() pause() next() prev() seek(90) vol(0.5) mute() speed(1.5)
Info: nowPlaying()
Debug: perf() domStats()
`,
        "color: #cad3f5;",
      );
    },
  };

  window.ytm = ytm;
  console.log(
    "%c[YTM Fast] Type ytm.help() for commands",
    "color: #c6a0f6; font-weight: bold;",
  );
})();
