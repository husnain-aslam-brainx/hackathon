import { MESSAGE_TYPES, SESSION_SOURCES } from '../lib/constants.js';
import {
  applyNotificationRules,
  clearNotificationRules,
  isValidHost,
  normalizeHostInput,
  updateBadge,
} from '../lib/focus-controller.js';
import { SessionRecorder } from '../lib/session-recorder.js';
import { getStoredState, saveWhitelist } from '../lib/stats-store.js';
import { TrackingManager } from '../lib/tracking-manager.js';

const recorder = new SessionRecorder();
const tracking = new TrackingManager();

async function getFullState() {
  const stored = await getStoredState();

  if (stored.focusActive) {
    return {
      focusActive: true,
      sessionStartedAt: recorder.startedAt ?? stored.sessionStartedAt,
      sessionSource: recorder.source ?? stored.sessionSource,
      whitelist: stored.whitelist,
      liveTotals: recorder.buffer.totals,
      lastSessionReport: stored.lastSessionReport,
    };
  }

  return {
    focusActive: false,
    sessionStartedAt: null,
    sessionSource: null,
    whitelist: stored.whitelist,
    liveTotals: {
      totalObservedAttempts: 0,
      observedBlockedAttempts: 0,
      observedAllowedAttempts: 0,
      observedNotificationAttempts: 0,
      observedPermissionRequests: 0,
    },
    lastSessionReport: stored.lastSessionReport,
  };
}

async function enableFocusMode(source = SESSION_SOURCES.MANUAL) {
  const state = await getStoredState();
  const whitelist = state.whitelist;

  await applyNotificationRules(whitelist);
  await tracking.registerScripts();
  await tracking.injectIntoOpenTabs(whitelist);

  const sessionState = await recorder.startSession(source);
  await updateBadge(true);

  return sessionState;
}

async function disableFocusMode() {
  await tracking.unregisterScripts();
  await clearNotificationRules();

  const report = await recorder.endSession();
  await updateBadge(false);

  return { report, focusActive: false };
}

async function updateWhitelist(whitelist) {
  const cleaned = [...new Set(whitelist.map(normalizeHostInput).filter(isValidHost))];
  await saveWhitelist(cleaned);
  recorder.setWhitelist(cleaned);

  const state = await getStoredState();
  if (state.focusActive) {
    await applyNotificationRules(cleaned);
    await tracking.broadcastConfig(cleaned);
  }

  return cleaned;
}

async function recoverOnStartup() {
  const state = await getStoredState();
  await recorder.loadFromStorage();

  if (state.focusActive) {
    try {
      await applyNotificationRules(state.whitelist);
      await tracking.registerScripts();
      await tracking.injectIntoOpenTabs(state.whitelist);
      recorder.startFlushTimer();
      await updateBadge(true);
    } catch (error) {
      console.error('Focus Mode recovery failed:', error);
    }
  } else {
    await updateBadge(false);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  recoverOnStartup().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  recoverOnStartup().catch(console.error);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((error) => {
    console.error(error);
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case MESSAGE_TYPES.GET_STATE:
    case MESSAGE_TYPES.GET_FOCUS_STATE:
      return { ok: true, state: await getFullState() };

    case MESSAGE_TYPES.TOGGLE_FOCUS: {
      const state = await getStoredState();
      if (state.focusActive) {
        const result = await disableFocusMode();
        return { ok: true, ...result };
      }
      const sessionState = await enableFocusMode(message.source ?? SESSION_SOURCES.MANUAL);
      return { ok: true, focusActive: true, state: sessionState };
    }

    case MESSAGE_TYPES.ENABLE_FOCUS: {
      const sessionState = await enableFocusMode(message.source ?? SESSION_SOURCES.MANUAL);
      return { ok: true, focusActive: true, state: sessionState };
    }

    case MESSAGE_TYPES.DISABLE_FOCUS: {
      const result = await disableFocusMode();
      return { ok: true, ...result };
    }

    case MESSAGE_TYPES.NOTIFICATION_ATTEMPT: {
      if (!recorder.startedAt) return { ok: true, ignored: true };

      const event = tracking.sanitizeAttempt(message.event);
      if (!event) return { ok: true, ignored: true };

      recorder.recordAttempt(event);
      return { ok: true };
    }

    case MESSAGE_TYPES.UPDATE_WHITELIST: {
      const whitelist = await updateWhitelist(message.whitelist ?? []);
      return { ok: true, whitelist };
    }

    default:
      return { ok: false, error: 'Unknown message type' };
  }
}

recoverOnStartup().catch(console.error);
