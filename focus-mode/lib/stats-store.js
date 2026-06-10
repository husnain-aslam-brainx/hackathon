import { STORAGE_KEYS } from './constants.js';
import { createEmptyBuffer } from './metrics.js';

export async function getStoredState() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.FOCUS_ACTIVE,
    STORAGE_KEYS.SESSION_STARTED_AT,
    STORAGE_KEYS.CURRENT_SESSION_ID,
    STORAGE_KEYS.SESSION_SOURCE,
    STORAGE_KEYS.WHITELIST,
    STORAGE_KEYS.LIVE_BUFFER,
    STORAGE_KEYS.LAST_SESSION_REPORT,
  ]);

  return {
    focusActive: Boolean(data[STORAGE_KEYS.FOCUS_ACTIVE]),
    sessionStartedAt: data[STORAGE_KEYS.SESSION_STARTED_AT] ?? null,
    currentSessionId: data[STORAGE_KEYS.CURRENT_SESSION_ID] ?? null,
    sessionSource: data[STORAGE_KEYS.SESSION_SOURCE] ?? 'manual',
    whitelist: Array.isArray(data[STORAGE_KEYS.WHITELIST]) ? data[STORAGE_KEYS.WHITELIST] : [],
    liveBuffer: data[STORAGE_KEYS.LIVE_BUFFER] ?? createEmptyBuffer(),
    lastSessionReport: data[STORAGE_KEYS.LAST_SESSION_REPORT] ?? null,
  };
}

export async function saveFocusSessionStart({ sessionId, startedAt, source, buffer }) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.FOCUS_ACTIVE]: true,
    [STORAGE_KEYS.SESSION_STARTED_AT]: startedAt,
    [STORAGE_KEYS.CURRENT_SESSION_ID]: sessionId,
    [STORAGE_KEYS.SESSION_SOURCE]: source,
    [STORAGE_KEYS.LIVE_BUFFER]: buffer,
  });
}

export async function saveLiveBuffer(buffer) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.LIVE_BUFFER]: buffer,
  });
}

export async function saveFocusSessionEnd({ lastSessionReport }) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.FOCUS_ACTIVE]: false,
    [STORAGE_KEYS.SESSION_STARTED_AT]: null,
    [STORAGE_KEYS.CURRENT_SESSION_ID]: null,
    [STORAGE_KEYS.SESSION_SOURCE]: null,
    [STORAGE_KEYS.LIVE_BUFFER]: createEmptyBuffer(),
    [STORAGE_KEYS.LAST_SESSION_REPORT]: lastSessionReport,
  });
}

export async function saveWhitelist(whitelist) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.WHITELIST]: whitelist,
  });
}
