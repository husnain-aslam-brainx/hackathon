import { CONTENT_SCRIPT_IDS } from './constants.js';

const HOOK_SCRIPT = 'page/notification-hook.js';
const BRIDGE_SCRIPT = 'content/bridge.js';

export class TrackingManager {
  async registerScripts() {
    await this.unregisterScripts();

    await chrome.scripting.registerContentScripts([
      {
        id: CONTENT_SCRIPT_IDS.HOOK,
        js: [HOOK_SCRIPT],
        matches: ['<all_urls>'],
        runAt: 'document_start',
        world: 'MAIN',
        allFrames: true,
        matchOriginAsFallback: true,
      },
      {
        id: CONTENT_SCRIPT_IDS.BRIDGE,
        js: [BRIDGE_SCRIPT],
        matches: ['<all_urls>'],
        runAt: 'document_start',
        allFrames: true,
        matchOriginAsFallback: true,
      },
    ]);
  }

  async unregisterScripts() {
    const ids = Object.values(CONTENT_SCRIPT_IDS);
    try {
      await chrome.scripting.unregisterContentScripts({ ids });
    } catch {
      // Scripts may not be registered yet.
    }
  }

  async injectIntoOpenTabs(whitelist) {
    const tabs = await chrome.tabs.query({});
    const eligibleTabs = tabs.filter((tab) => tab.id && tab.url?.startsWith('http'));

    await Promise.all(
      eligibleTabs.map(async (tab) => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: [HOOK_SCRIPT],
            world: 'MAIN',
            injectImmediately: true,
          });
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: [BRIDGE_SCRIPT],
            injectImmediately: true,
          });
          await chrome.tabs.sendMessage(tab.id, {
            type: 'FOCUS_MODE_INIT',
            whitelist,
          });
        } catch {
          // Tab may be inaccessible (chrome://, etc.).
        }
      }),
    );
  }

  async broadcastConfig(whitelist) {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs
        .filter((tab) => tab.id)
        .map((tab) =>
          chrome.tabs.sendMessage(tab.id, { type: 'FOCUS_MODE_INIT', whitelist }).catch(() => {}),
        ),
    );
  }

  sanitizeAttempt(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const host = typeof raw.host === 'string' ? raw.host.slice(0, 253) : 'unknown';
    const kind = raw.kind === 'permission_request' ? 'permission_request' : 'notification';
    const timestamp = typeof raw.timestamp === 'number' ? raw.timestamp : Date.now();

    return { host, kind, timestamp, frame: Boolean(raw.frame) };
  }
}
