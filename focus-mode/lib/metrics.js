import { ATTEMPT_KINDS } from './constants.js';

export const METRIC_LABELS = {
  totalObservedAttempts: 'Observed attempts',
  observedBlockedAttempts: 'Blocked (observed)',
  observedAllowedAttempts: 'Allowed — whitelisted',
  observedNotificationAttempts: 'Notification attempts (observed)',
  observedPermissionRequests: 'Permission requests (observed)',
  sessionDuration: 'Focus duration',
  uniqueDomainsObserved: 'Sites with observed activity',
};

export function isHostWhitelisted(host, whitelist) {
  if (!host || host === 'unknown') return false;
  const normalized = host.toLowerCase();
  return whitelist.some((entry) => {
    const pattern = entry.toLowerCase().replace(/^\*\./, '');
    return normalized === pattern || normalized.endsWith(`.${pattern}`);
  });
}

export function createEmptyDomainStats(allowed = false) {
  return {
    observedBlockedAttempts: 0,
    observedAllowedAttempts: 0,
    observedNotificationAttempts: 0,
    observedPermissionRequests: 0,
    allowed,
    firstAt: null,
    lastAt: null,
  };
}

export function recordAttemptEvent(buffer, event, whitelist) {
  const host = event.host || 'unknown';
  const allowed = isHostWhitelisted(host, whitelist);
  const timestamp = event.timestamp || Date.now();

  if (!buffer.byDomain[host]) {
    buffer.byDomain[host] = createEmptyDomainStats(allowed);
  }

  const domain = buffer.byDomain[host];
  domain.allowed = allowed;
  domain.firstAt = domain.firstAt ?? timestamp;
  domain.lastAt = timestamp;

  if (event.kind === ATTEMPT_KINDS.PERMISSION_REQUEST) {
    domain.observedPermissionRequests += 1;
  } else {
    domain.observedNotificationAttempts += 1;
  }

  if (allowed) {
    domain.observedAllowedAttempts += 1;
    buffer.totals.observedAllowedAttempts += 1;
  } else {
    domain.observedBlockedAttempts += 1;
    buffer.totals.observedBlockedAttempts += 1;
  }

  buffer.totals.totalObservedAttempts += 1;

  if (event.kind === ATTEMPT_KINDS.PERMISSION_REQUEST) {
    buffer.totals.observedPermissionRequests += 1;
  } else {
    buffer.totals.observedNotificationAttempts += 1;
  }
}

export function createEmptyBuffer() {
  return {
    byDomain: {},
    totals: {
      totalObservedAttempts: 0,
      observedBlockedAttempts: 0,
      observedAllowedAttempts: 0,
      observedNotificationAttempts: 0,
      observedPermissionRequests: 0,
    },
  };
}

export function computeDomainDistractionScore(domainStats, sessionDurationMs) {
  const blocked = domainStats.observedBlockedAttempts || 0;
  const permissionRequests = domainStats.observedPermissionRequests || 0;
  const sessionMinutes = Math.max(sessionDurationMs / 60000, 1);

  const raw = blocked * 10 + permissionRequests * 3;
  const rate = raw / sessionMinutes;
  return Math.min(100, Math.round(rate * 8 + Math.log2(blocked + 1) * 5));
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '0m';

  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function buildSessionReport({
  sessionId,
  startedAt,
  endedAt,
  buffer,
  whitelist,
  source,
}) {
  const durationMs = endedAt - startedAt;
  const domains = Object.entries(buffer.byDomain)
    .map(([host, stats]) => ({
      host,
      observedBlockedAttempts: stats.observedBlockedAttempts,
      observedAllowedAttempts: stats.observedAllowedAttempts,
      observedNotificationAttempts: stats.observedNotificationAttempts,
      observedPermissionRequests: stats.observedPermissionRequests,
      allowed: stats.allowed,
      distractionScore: computeDomainDistractionScore(stats, durationMs),
    }))
    .sort((a, b) => b.observedBlockedAttempts - a.observedBlockedAttempts);

  return {
    sessionId,
    startedAt,
    endedAt,
    durationMs,
    durationLabel: formatDuration(durationMs),
    source,
    totals: { ...buffer.totals },
    uniqueDomainsObserved: domains.length,
    topDomains: domains.filter((d) => d.observedBlockedAttempts > 0).slice(0, 5),
    allowedDomains: domains.filter((d) => d.observedAllowedAttempts > 0),
    whitelistedDomains: [...whitelist],
    disclaimer: 'Background push notifications may have been blocked but not included in this count.',
  };
}
