// core/debug.js — loaded first, always
// Enable verbose logs in DevTools: _ytmDev = true

(function () {
  const isDev = () => !!window._ytmDev;

  window.ytmLog = {
    log: (...a) =>
      isDev() && console.log("%c[ytm]", "color:#c6a0f6;font-weight:bold", ...a),
    warn: (...a) =>
      console.warn("%c[ytm]", "color:#eed49f;font-weight:bold", ...a),
    error: (...a) =>
      console.error("%c[ytm]", "color:#ed8796;font-weight:bold", ...a),
    info: (...a) =>
      isDev() &&
      console.info("%c[ytm]", "color:#8aadf4;font-weight:bold", ...a),
  };
})();
