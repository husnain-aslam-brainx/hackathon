(function () {
  if (window.__focusModeBridgeInstalled) return;
  window.__focusModeBridgeInstalled = true;

  const HOOK_SOURCE = 'focus-mode-hook';
  const INIT_SOURCE = 'focus-mode-extension';
  const ATTEMPT_TYPE = 'FOCUS_MODE_ATTEMPT';

  function postInit(whitelist) {
    window.postMessage(
      {
        source: INIT_SOURCE,
        type: 'FOCUS_MODE_INIT',
        whitelist: Array.isArray(whitelist) ? whitelist : [],
      },
      '*',
    );
  }

  function forwardAttempt(payload) {
    if (!payload || typeof payload !== 'object') return;

    chrome.runtime.sendMessage({
      type: 'NOTIFICATION_ATTEMPT',
      event: {
        kind: payload.kind === 'permission_request' ? 'permission_request' : 'notification',
        host: typeof payload.host === 'string' ? payload.host : 'unknown',
        timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
        frame: Boolean(payload.frame),
      },
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== HOOK_SOURCE) return;
    if (event.data.type !== ATTEMPT_TYPE) return;
    forwardAttempt(event.data.payload);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'FOCUS_MODE_INIT') {
      postInit(message.whitelist);
    }
  });

  chrome.runtime.sendMessage({ type: 'GET_FOCUS_STATE' }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) return;
    if (!response.state?.focusActive) return;
    postInit(response.state.whitelist);
  });
})();
