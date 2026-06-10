import { buildSessionReport, createEmptyBuffer, recordAttemptEvent } from './metrics.js';
import {
  getStoredState,
  saveFocusSessionEnd,
  saveFocusSessionStart,
  saveLiveBuffer,
} from './stats-store.js';

const FLUSH_INTERVAL_MS = 30000;

export class SessionRecorder {
  constructor() {
    this.buffer = createEmptyBuffer();
    this.startedAt = null;
    this.sessionId = null;
    this.source = 'manual';
    this.whitelist = [];
    this.flushTimer = null;
  }

  async loadFromStorage() {
    const state = await getStoredState();
    this.buffer = state.liveBuffer ?? createEmptyBuffer();
    this.startedAt = state.sessionStartedAt;
    this.sessionId = state.currentSessionId;
    this.source = state.sessionSource ?? 'manual';
    this.whitelist = state.whitelist;
    return state;
  }

  async startSession(source = 'manual') {
    this.buffer = createEmptyBuffer();
    this.startedAt = Date.now();
    this.sessionId = crypto.randomUUID();
    this.source = source;
    const state = await getStoredState();
    this.whitelist = state.whitelist;

    await saveFocusSessionStart({
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      source: this.source,
      buffer: this.buffer,
    });

    this.startFlushTimer();
    return this.getPublicState();
  }

  async endSession() {
    this.stopFlushTimer();
    const endedAt = Date.now();
    const state = await getStoredState();
    this.whitelist = state.whitelist;

    const report = buildSessionReport({
      sessionId: this.sessionId,
      startedAt: this.startedAt ?? endedAt,
      endedAt,
      buffer: this.buffer,
      whitelist: this.whitelist,
      source: this.source,
    });

    await saveFocusSessionEnd({ lastSessionReport: report });

    this.buffer = createEmptyBuffer();
    this.startedAt = null;
    this.sessionId = null;

    return report;
  }

  setWhitelist(whitelist) {
    this.whitelist = whitelist;
  }

  recordAttempt(event) {
    recordAttemptEvent(this.buffer, event, this.whitelist);
  }

  async flush() {
    if (!this.startedAt) return;
    await saveLiveBuffer(this.buffer);
  }

  startFlushTimer() {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, FLUSH_INTERVAL_MS);
  }

  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  getPublicState() {
    return {
      focusActive: Boolean(this.startedAt),
      sessionStartedAt: this.startedAt,
      currentSessionId: this.sessionId,
      sessionSource: this.source,
      whitelist: this.whitelist,
      liveTotals: this.buffer.totals,
    };
  }
}
