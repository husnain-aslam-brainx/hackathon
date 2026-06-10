(function () {
  if (window.__focusModeHookInstalled) return;
  window.__focusModeHookInstalled = true;

  const MESSAGE_SOURCE = 'focus-mode-hook';
  const INIT_SOURCE = 'focus-mode-extension';
  const ATTEMPT_TYPE = 'FOCUS_MODE_ATTEMPT';

  let whitelist = [];

  function normalizeHost(host) {
    return String(host || 'unknown')
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
  }

  function isWhitelisted(host) {
    const normalized = normalizeHost(host);
    return whitelist.some((entry) => {
      const pattern = String(entry).toLowerCase().replace(/^\*\./, '');
      return normalized === pattern || normalized.endsWith('.' + pattern);
    });
  }

  function emitAttempt(kind) {
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: ATTEMPT_TYPE,
        payload: {
          kind: kind,
          host: normalizeHost(window.location.hostname) || 'unknown',
          timestamp: Date.now(),
          frame: window.top === window,
        },
      },
      '*',
    );
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== INIT_SOURCE) return;
    if (event.data.type !== 'FOCUS_MODE_INIT') return;
    whitelist = Array.isArray(event.data.whitelist) ? event.data.whitelist : [];
  });

  const OriginalNotification = window.Notification;
  if (!OriginalNotification) return;

  function WrappedNotification(title, options) {
    const host = normalizeHost(window.location.hostname) || 'unknown';
    emitAttempt('notification');

    if (!isWhitelisted(host)) {
      return {
        close: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {
          return true;
        },
        onclick: null,
        onclose: null,
        onerror: null,
        onshow: null,
        title: String(title || ''),
        tag: options && options.tag ? String(options.tag) : '',
        body: options && options.body ? String(options.body) : '',
        icon: options && options.icon ? String(options.icon) : '',
        dir: 'auto',
        lang: '',
        data: options && options.data ? options.data : null,
      };
    }

    return new OriginalNotification(title, options);
  }

  WrappedNotification.prototype = OriginalNotification.prototype;
  Object.defineProperty(WrappedNotification, 'name', { value: 'Notification' });

  WrappedNotification.requestPermission = function requestPermission(callback) {
    emitAttempt('permission_request');
    return OriginalNotification.requestPermission.call(OriginalNotification, callback);
  };

  Object.defineProperty(WrappedNotification, 'permission', {
    get: function () {
      return OriginalNotification.permission;
    },
  });

  if ('maxActions' in OriginalNotification) {
    WrappedNotification.maxActions = OriginalNotification.maxActions;
  }

  window.Notification = WrappedNotification;
})();
