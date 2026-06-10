import { GLOBAL_PATTERN } from './constants.js';

function hostPattern(host) {
  const cleaned = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return `*://${cleaned}/*`;
}

export async function applyNotificationRules(whitelist) {
  await chrome.contentSettings.notifications.set({
    primaryPattern: GLOBAL_PATTERN,
    setting: 'block',
  });

  for (const host of whitelist) {
    if (!host.trim()) continue;
    await chrome.contentSettings.notifications.set({
      primaryPattern: hostPattern(host),
      setting: 'allow',
    });
  }
}

export async function clearNotificationRules() {
  await chrome.contentSettings.notifications.clear({ scope: 'regular' });
}

export async function updateBadge(focusActive) {
  if (focusActive) {
    await chrome.action.setBadgeText({ text: 'ON' });
    await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
    await chrome.action.setTitle({ title: 'Focus Mode — Active' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Focus Mode' });
  }
}

export function normalizeHostInput(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\*\./, '');
}

export function isValidHost(value) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value);
}
