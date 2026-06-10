# Focus Mode Chrome Extension

Block website notifications during focus sessions and report observed interruption attempts.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `focus-mode/` directory

## Release 1 features

- One-click Focus Mode toggle from the toolbar popup
- Reliable notification blocking via `chrome.contentSettings`
- Observed attempt tracking via page-world Notification API hook
- Session report on disable (duration, observed/blocked/allowed counts, top domains)
- Domain whitelist (inline in popup)

## Test blocking and tracking

1. Open a site that uses notifications (or run in DevTools on any page):

```javascript
Notification.requestPermission();
new Notification('Test', { body: 'Should be blocked during Focus Mode' });
```

2. Enable Focus Mode from the toolbar icon.
3. Run the snippet again — the notification should be blocked and the attempt counted.
4. Disable Focus Mode and review the session report in the popup.

## Project structure

```
focus-mode/
├── manifest.json
├── background/service-worker.js
├── lib/                  # Core modules
├── content/bridge.js     # Isolated-world message bridge
├── page/notification-hook.js  # MAIN-world Notification hook
├── popup/                # Toolbar popup UI
└── icons/
```

## Metric labels

All attempt counts are **observed** — detected via the Notification API in open tabs. Background push notifications may be blocked but are not included in counts.

## Roadmap

- **Release 2:** Options page, scheduling, keyboard shortcut
- **Release 3:** Dashboard, distraction scores, historical trends
- **Release 4:** CWS hardening, data export/delete
- **Release 5:** Coverage metrics, optional push estimates
