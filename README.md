# YouTube Music Control

A browser extension for YouTube Music that adds keyboard shortcuts, a command palette, performance tweaks, and a Catppuccin Macchiato theme.

## Features

### Keyboard Shortcuts
- Space - Play / Pause
- N / B - Next / Previous track
- L - Toggle loop/repeat
- Left / Right arrow - Seek ±5 seconds
- 0-9 - Seek to 0%-90% of track
- - / = - Volume down / up
- Backspace - SPA back navigation (no reload)
- / - Open command palette
- Shift+P - Add current song to a playlist
- P - Play current playlist (when on playlist page)
- Ctrl+/ - Show shortcuts reference
- Alt+/ - Open/close command palette

### Command Palette (Alt+/ or /)
- Search YouTube Music directly from the palette
- Type "/" followed by a playlist name to browse and play from your playlists
- Type "/playlistname" then press "/" again to drill into songs within that playlist
- Quick navigation to Home, Explore, Library, and New playlist
- Search suggestions as you type

### Performance & UI
- Custom loading screen injected at document start
- PWA manifest override with extension icons
- Lazy-loading for non-critical images
- Auto-dismiss "Are you still there?" dialog
- Disable video player page popup (optional, user click to open)
- Remove GPU-heavy backdrop filters from non-essential elements
- Hide "Upgrade" upsell in sidebar

### Developer Console Tools
Type `ytm` in the console to access:
- `ytm.play()` / `ytm.pause()` / `ytm.next()` / `ytm.prev()`
- `ytm.seek(seconds)` / `ytm.seekBy(seconds)`
- `ytm.vol(0-1)` / `ytm.mute()`
- `ytm.nowPlaying()` - Get current track info
- `ytm.perf()` - Performance metrics
- `ytm.domStats()` - DOM node analysis

## Installation

### Chrome / Brave / Edge
1. Clone or download this repository
2. Open `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder

### Firefox
*Convert manifest v3 to v2 or use temporary add-on loading*


## Architecture

The extension uses two content scripts:

1. **document_start** - Loads debug, loader, and PWA override before page parsing
2. **document_idle** - Loads DOM utils, network layer, features after page is ready

### Caching Strategy
- Playlists - `chrome.storage.local` with 1 hour TTL (persists across restarts)
- Songs - In-memory Map (tab lifetime only)
- Suggestions - Never cached, fetched fresh each time

### Dependencies
The modules follow a dependency chain:
- `debug.js` → defines `window.ytmLog`
- `dom.js` → depends on debug, exports `window.ytmDom`
- `network.js` → depends on debug, exports `window.ytmNet`
- `palette.js` → depends on dom + network

## Configuration

### Enable Debug Logs
Open DevTools and run:
```javascript
window._ytmDev = true
  ```

### Cache Management
```javascript
ytmPalette.clearCache()  // Clears playlist/song cache from UI
ytmNet.clearCache()      // Clears from console
  ```
