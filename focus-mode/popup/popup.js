const MESSAGE_TYPES = {
  GET_STATE: 'GET_STATE',
  TOGGLE_FOCUS: 'TOGGLE_FOCUS',
  UPDATE_WHITELIST: 'UPDATE_WHITELIST',
};

const elements = {
  toggleBtn: document.getElementById('toggle-btn'),
  statusText: document.getElementById('status-text'),
  livePanel: document.getElementById('live-panel'),
  reportPanel: document.getElementById('report-panel'),
  sessionTimer: document.getElementById('session-timer'),
  liveAttempts: document.getElementById('live-attempts'),
  reportDuration: document.getElementById('report-duration'),
  reportTotal: document.getElementById('report-total'),
  reportBlocked: document.getElementById('report-blocked'),
  reportAllowed: document.getElementById('report-allowed'),
  reportDisclaimer: document.getElementById('report-disclaimer'),
  topDomains: document.getElementById('top-domains'),
  whitelistForm: document.getElementById('whitelist-form'),
  whitelistInput: document.getElementById('whitelist-input'),
  whitelistList: document.getElementById('whitelist-list'),
};

let state = {
  focusActive: false,
  sessionStartedAt: null,
  whitelist: [],
  liveTotals: { totalObservedAttempts: 0 },
  lastSessionReport: null,
};

let timerInterval = null;

function formatDuration(ms) {
  if (!ms || ms < 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function normalizeHost(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\*\./, '');
}

function isValidHost(value) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value);
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function renderWhitelist() {
  elements.whitelistList.innerHTML = '';

  if (!state.whitelist.length) {
    elements.whitelistList.innerHTML = '<li class="empty-state">No whitelisted domains yet.</li>';
    return;
  }

  state.whitelist.forEach((host) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = host;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeWhitelistHost(host));

    item.append(label, removeBtn);
    elements.whitelistList.appendChild(item);
  });
}

function renderTopDomains(report) {
  elements.topDomains.innerHTML = '';

  if (!report.topDomains?.length) {
    elements.topDomains.innerHTML = '<div class="empty-state">No observed blocked attempts this session.</div>';
    return;
  }

  report.topDomains.forEach((domain) => {
    const row = document.createElement('div');
    row.className = 'domain-item';
    row.innerHTML = `<span>${domain.host}</span><span>${domain.observedBlockedAttempts} blocked · score ${domain.distractionScore}</span>`;
    elements.topDomains.appendChild(row);
  });
}

function renderReport(report) {
  if (!report) {
    elements.reportPanel.classList.add('hidden');
    return;
  }

  elements.reportPanel.classList.remove('hidden');
  elements.reportDuration.textContent = report.durationLabel;
  elements.reportTotal.textContent = String(report.totals.totalObservedAttempts);
  elements.reportBlocked.textContent = String(report.totals.observedBlockedAttempts);
  elements.reportAllowed.textContent = String(report.totals.observedAllowedAttempts);
  elements.reportDisclaimer.textContent = report.disclaimer;
  renderTopDomains(report);
}

function updateLiveTimer() {
  if (!state.focusActive || !state.sessionStartedAt) {
    elements.sessionTimer.textContent = '0m';
    return;
  }
  elements.sessionTimer.textContent = formatDuration(Date.now() - state.sessionStartedAt);
}

function render() {
  elements.toggleBtn.setAttribute('aria-pressed', String(state.focusActive));

  if (state.focusActive) {
    elements.statusText.textContent = 'Blocking website notifications';
    elements.statusText.classList.add('active');
    elements.livePanel.classList.remove('hidden');
    elements.reportPanel.classList.add('hidden');
    elements.liveAttempts.textContent = String(state.liveTotals?.totalObservedAttempts ?? 0);
    updateLiveTimer();
  } else {
    elements.statusText.textContent = 'Notifications allowed';
    elements.statusText.classList.remove('active');
    elements.livePanel.classList.add('hidden');
    if (state.lastSessionReport) {
      renderReport(state.lastSessionReport);
    }
  }

  renderWhitelist();
}

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    updateLiveTimer();
    refreshState().catch(console.error);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function refreshState() {
  const response = await sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  if (!response?.ok) return;

  const wasActive = state.focusActive;
  state = response.state;

  if (state.focusActive) {
    startTimer();
  } else {
    stopTimer();
    if (wasActive && state.lastSessionReport) {
      renderReport(state.lastSessionReport);
    }
  }

  render();
}

async function toggleFocusMode() {
  elements.toggleBtn.disabled = true;
  try {
    const response = await sendMessage({ type: MESSAGE_TYPES.TOGGLE_FOCUS });
    if (!response?.ok) throw new Error(response?.error || 'Toggle failed');

    if (response.focusActive === false && response.report) {
      state.focusActive = false;
      state.lastSessionReport = response.report;
      stopTimer();
      render();
      return;
    }

    await refreshState();
  } catch (error) {
    console.error(error);
  } finally {
    elements.toggleBtn.disabled = false;
  }
}

async function addWhitelistHost(rawValue) {
  const host = normalizeHost(rawValue);
  if (!isValidHost(host)) {
    elements.whitelistInput.classList.add('error-text');
    return;
  }

  const nextWhitelist = [...new Set([...state.whitelist, host])];
  const response = await sendMessage({
    type: MESSAGE_TYPES.UPDATE_WHITELIST,
    whitelist: nextWhitelist,
  });

  if (response?.ok) {
    state.whitelist = response.whitelist;
    elements.whitelistInput.value = '';
    renderWhitelist();
  }
}

async function removeWhitelistHost(host) {
  const nextWhitelist = state.whitelist.filter((entry) => entry !== host);
  const response = await sendMessage({
    type: MESSAGE_TYPES.UPDATE_WHITELIST,
    whitelist: nextWhitelist,
  });

  if (response?.ok) {
    state.whitelist = response.whitelist;
    renderWhitelist();
  }
}

elements.toggleBtn.addEventListener('click', toggleFocusMode);

elements.whitelistForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addWhitelistHost(elements.whitelistInput.value).catch(console.error);
});

refreshState().catch(console.error);
