// player.js — block auto video popup, pause on load, dismiss "are you still there?"

// ── 1. Pause on page load / reload ───────────────────────────────────────────
// YTM resumes playback on reload — we kill it as soon as the video element exists
function pauseOnLoad() {
  const video = document.querySelector("video");
  if (video) {
    video.pause();
    video.addEventListener(
      "play",
      (e) => {
        // Only block auto-play in the first 3 seconds after load
        if (performance.now() < 3000) {
          video.pause();
        }
      },
      { once: false },
    );
    return;
  }
  // Video element not ready yet — wait for it
  const waitForVideo = new MutationObserver(() => {
    const v = document.querySelector("video");
    if (v) {
      waitForVideo.disconnect();
      v.pause();
      let blocked = true;
      setTimeout(() => {
        blocked = false;
      }, 3000);
      v.addEventListener("play", () => {
        if (blocked) v.pause();
      });
    }
  });
  waitForVideo.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pauseOnLoad);
} else {
  pauseOnLoad();
}

// ── 2. Block auto-opening of video player page ────────────────────────────────
let userClickedOpen = false;

document.addEventListener(
  "click",
  (e) => {
    const clickedPlayerBar =
      e.target.closest("ytmusic-player-bar") ||
      e.target.closest(".toggle-player-page-button") ||
      e.target.closest("#song-image") ||
      e.target.closest(".content-info-wrapper") ||
      e.target.closest("#thumbnail");

    if (clickedPlayerBar) {
      userClickedOpen = true;
      setTimeout(() => {
        userClickedOpen = false;
      }, 1000);
    }
  },
  true,
);

const pageObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      const playerPage =
        node.tagName === "YTMUSIC-PLAYER-PAGE"
          ? node
          : node.querySelector?.("ytmusic-player-page");
      if (playerPage && !userClickedOpen) playerPage.style.display = "none";
    }
    if (
      mutation.type === "attributes" &&
      mutation.target.tagName === "YTMUSIC-PLAYER-PAGE"
    ) {
      if (!userClickedOpen) mutation.target.style.display = "none";
      else mutation.target.style.display = "";
    }
  }
});

pageObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["player-ui-state", "player-page-open", "style", "class"],
});

window.addEventListener("load", () => {
  const playerPage = document.querySelector("ytmusic-player-page");
  if (playerPage && !userClickedOpen) playerPage.style.display = "none";
});

// ── 3. Auto-dismiss "Are you still there?" ───────────────────────────────────
const dialogObserver = new MutationObserver(() => {
  const youThere = document.querySelector("ytmusic-you-there-renderer");
  if (youThere) {
    const btn = youThere.querySelector(
      'yt-button-renderer, paper-button, button, [role="button"]',
    );
    if (btn) btn.click();
    else youThere.remove();
  }
  document
    .querySelectorAll("tp-yt-paper-dialog, ytmusic-dialog-renderer")
    .forEach((dialog) => {
      if (!dialog.offsetParent) return;
      const text = (dialog.innerText || "").toLowerCase();
      if (
        text.includes("still there") ||
        text.includes("still watching") ||
        text.includes("are you there")
      ) {
        const btn = dialog.querySelector(
          "yt-button-renderer, paper-button, button",
        );
        if (btn) btn.click();
        else dialog.remove();
      }
    });
});

dialogObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
