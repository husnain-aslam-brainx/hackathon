export const STORAGE_KEYS = {
  FOCUS_ACTIVE: 'focusActive',
  SESSION_STARTED_AT: 'sessionStartedAt',
  CURRENT_SESSION_ID: 'currentSessionId',
  SESSION_SOURCE: 'sessionSource',
  WHITELIST: 'whitelist',
  LIVE_BUFFER: 'liveBuffer',
  LAST_SESSION_REPORT: 'lastSessionReport',
};

export const MESSAGE_TYPES = {
  GET_STATE: 'GET_STATE',
  TOGGLE_FOCUS: 'TOGGLE_FOCUS',
  ENABLE_FOCUS: 'ENABLE_FOCUS',
  DISABLE_FOCUS: 'DISABLE_FOCUS',
  GET_FOCUS_STATE: 'GET_FOCUS_STATE',
  NOTIFICATION_ATTEMPT: 'NOTIFICATION_ATTEMPT',
  UPDATE_WHITELIST: 'UPDATE_WHITELIST',
  STATE_CHANGED: 'STATE_CHANGED',
};

export const ATTEMPT_KINDS = {
  NOTIFICATION: 'notification',
  PERMISSION_REQUEST: 'permission_request',
};

export const SESSION_SOURCES = {
  MANUAL: 'manual',
  SCHEDULED: 'scheduled',
  SHORTCUT: 'shortcut',
};

export const CONTENT_SCRIPT_IDS = {
  HOOK: 'focus-mode-hook',
  BRIDGE: 'focus-mode-bridge',
};

export const METRICS_DISCLAIMER =
  'Background push notifications may have been blocked but not included in this count.';

export const GLOBAL_PATTERN = '*://*/*';
