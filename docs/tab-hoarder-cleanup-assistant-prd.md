# Tab Hoarder Cleanup Assistant — PRD

**Status:** v1 locked for build
**Date:** 2026-07-15
**Owner:** Husnain Aslam

---

## 1. Overview

A Chrome extension (Manifest V3) that scores open tabs, surfaces grouped close-candidates with a one-line reason each, and lets the user confirm a batch close with a reliable undo. The extension never closes anything on its own.

## 2. Problem Statement

Power users accumulate 40+ open tabs. They can't tell which are safe to close, so they close nothing. Memory bloats, the tab strip becomes unusable, and important tabs get buried among dead ones.

Why people don't just close tabs themselves:
- **Fear of loss** — no confidence they can find a tab again if they're wrong about it being safe to close.
- **Decision fatigue** — evaluating 40+ tabs one at a time is exhausting, so the default becomes doing nothing.
- **Tabs as working state, not just references** — a tab mid-form, mid-video, or holding a scoped session isn't "a link I might need," it's in-progress state that can't be reconstructed by reopening the URL. This is why the protection rules (§6) matter as much as the scoring itself — a tool that can't tell "reference" from "state" won't be trusted.

## 3. Target User

A single "tab hoarder" — someone who keeps tabs open as a to-do list / memory crutch and is afraid of losing something by closing the wrong one. Not a team feature, not multi-user.

## 4. Goals / Success Definition

**North star:** the user bulk-closes tabs they would not have closed unassisted, and never has to reopen the extension to recover one. Fear of loss is what's being removed — not tab count.

**Definition of done (v1 acceptance):**
- User opens the extension and sees a scored list of close candidates, grouped, each with a one-line reason.
- User can deselect individual tabs or entire groups before confirming.
- Confirming closes only what remains selected.
- Undo restores everything from the last cleanup, reliably, within the current browser session.
- The extension never closes a tab without an explicit confirm action.

Note on decision fatigue: a flat scored list the user must individually review is the same cognitive load as manually triaging tabs. Grouping by category with group-level select/deselect (§5, FR3) is the mitigation — it lets the user act on a whole category at once instead of reading N one-line reasons individually.

## 5. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR1 | Score every open tab based on staleness, duplication, and likely irrelevance. |
| FR2 | Show suggestions grouped by category, each tab with a short, human-readable reason. |
| FR3 | Pre-select all suggestions; allow deselecting individual tabs or entire groups before confirming. |
| FR4 | Provide undo that restores all tabs from the last cleanup — URL, pinned state, and window placement — for at least the current browser session. |
| FR5 | Never suggest tabs that are pinned, playing media, contain unsubmitted form data, are currently active, or belong to the tab group the user is actively working in. |
| FR6 | Work immediately with no setup required. |

## 6. Protection Rules (never-suggest list)

Locked for v1, per FR5: **pinned · playing media · unsubmitted form data · currently active · active tab group.**

Unsubmitted form data cannot be reliably detected via extension APIs (no direct "has unsaved input" signal). Fallback: treat any tab containing form elements that the user interacted with (clicked/typed) within a recent time window as protected, even without confirming a real dirty state. Bias toward false negatives (fewer suggestions) over false positives (closing something with real input) — a false positive here directly undermines the fear-of-loss goal in §4.

Candidates considered but **not** adopted into v1 scope — see §11 Open Questions:
- Generic `beforeunload`/"leave site?" handlers (broader than form fields — e.g. in-browser editors).
- Active camera/mic/screen-share tabs.
- Tabs mid-navigation at scoring time.
- The last remaining tab in a window.
- A short grace period for very recently opened tabs (to avoid flagging an intentional side-by-side duplicate).

## 7. Non-Functional Requirements

- Analyze 100+ tabs in under 2 seconds.
- All processing local — no tab data leaves the browser.
- Minimum Chrome permissions necessary for the above.
- Near-zero idle resource usage — no constant background polling.

## 8. Out of Scope (v1)

Tab archiving/bookmarking, cross-device sync, session management features, machine learning for relevance scoring, scheduled/automatic cleanups, non-Chrome browser support.

## 9. Architecture

### 9.1 Components

**Service worker (event-driven)**
- Listeners: `tabs.onActivated` (bump ledger `lastActiveAt` / `activationCount`), `tabs.onCreated` (set `createdAt`), `tabs.onRemoved` (delete ledger entry), `runtime.onStartup` (prune ledger entries for tabs that no longer exist; set a staleness-suppressed flag so scores immediately after a fresh browser start — when all tabs restore at once — don't read as uniformly stale or fresh).
- All listeners registered synchronously at the top level of the service worker script, per MV3 requirements for Chrome to correctly wake the worker on these events.
- Badge updater: recomputes **synchronously** on each relevant event. No `setTimeout`-based debounce — the service worker can be suspended while a timer is pending, silently dropping the update. The computation is cheap enough not to need debouncing. The badge count is produced by calling the same pure scoring module the review page uses (fed with fresh `tabs.query` + ledger data), so the badge number and the review page's suggestion count never disagree.

**Review page** (`chrome-extension://…/review.html`)
- On load: `chrome.tabs.query({})` + read ledger from `storage.local` → scoring module → grouped render.
- Selection state mirrored to `storage.session` on every toggle, so an accidental page close loses nothing.
- Rendering: single source-of-truth state object (e.g. `Map<tabId, selected>`) with a full-subtree re-render on change, not imperative per-event DOM patches. This is specifically to keep indeterminate select-all checkboxes and per-group counts correct as the user toggles arbitrary combinations — the place hand-rolled DOM patching most commonly drifts.
- Excludes its own `chrome-extension://` URL from the candidate list by scheme (not only via the "currently active" check, which can miss it in multi-window setups).

**Scoring module** (pure functions, zero Chrome API calls)
- Input: array of `{tab metadata, ledger entry}`.
- Output: array of `{tabId, score, groupKey, reasonString}`.
- Signals: staleness (ledger `lastActiveAt`, falling back to `tab.lastAccessed`), duplication (normalized-URL match, keeping the most-recently-active twin), irrelevance heuristics (e.g. search-results pages, dead `chrome://` leftovers, near-identical docs).
- Unit-tested in isolation (Vitest); imported by both the review page and the service worker's badge updater — it is shared, not duplicated.

**Closer/undo module**
- Confirm → re-validate protections against **current live tab state** (not the state at scoring time, which may be stale) → **write the undo record to `storage.session` first** → `tabs.remove(batch)` → toast on the review page.
- Order matters: the undo record must be durably written *before* the destructive close, not after — otherwise a crash or error between the two steps closes tabs with zero way to recover them, which is the one failure mode this product exists to prevent.
- Undo record per tab: `{url, pinned, windowId, index, title, favicon}`. Favicon is for toast display only (fetched via the `favicon` permission's local lookup, not passed to tab recreation).
- Undo stack: max 3 entries, in `storage.session` (cleared on browser close — matches the "current session" requirement in FR4).
- Restoring: `tabs.create` (with `windows.create` first if the source window is gone). `index` is best-effort — clamp to the current tab count rather than erroring, and prioritize preserving relative order *within* the restored batch over exact original position, since absolute index drifts the moment anything else changes in that window between close and undo.
- Undo restores URL, pinned state, and window placement only — not in-page state (scroll position, form contents, JS session state). This is surfaced in the undo toast copy so users don't expect a full state restore.

### 9.2 Data Flow

```
tab events → ledger (storage.local)
review page opens → tabs.query + ledger → scoring module → grouped render
user confirms → re-validate protections → undo record written (storage.session)
                → tabs.remove(batch) → undo stack updated → toast
undo clicked → tabs.create / windows.create from stored record
```

### 9.3 Permissions

| Permission | Justification |
|---|---|
| `tabs` | Tab metadata (url, title, favIconUrl, pinned, audible, lastAccessed) and `tabs.remove` / `tabs.create`. |
| `storage` | `storage.local` for the ledger, `storage.session` for selection state and the undo stack. |
| `favicon` | Local favicon lookup for closed tabs in the undo toast, without re-requesting the icon from the remote site after the tab is gone. |
| `tabGroups` | Read group metadata to detect the tab group the user is actively working in (FR5). |

`downloads` is **dropped** from the permission list — it wasn't wired to any functional requirement. Revisit only if "protect tabs with an active download" is added to §6 (see §11).

No `scripting` / host permissions — the form-data fallback in §6 avoids content-script injection, keeping the permission surface minimal and matching NFR3.

### 9.4 Tech Stack

Vanilla TypeScript + Vite build, no UI framework (one page, a list, checkboxes — a framework is unwarranted overhead at this scope). Vitest for the scoring module. Manifest V3.

## 10. Known Edge Cases & Handling

- **Both copies of a duplicate suggested:** duplication logic keeps the most-recently-active twin, suggests the rest.
- **Tab or window closed between scoring and confirm:** re-validated at confirm time; a missing tabId is a no-op for that item, not a batch failure.
- **Tab navigated/state changed between scoring and confirm:** re-validation at confirm is the actual safety net; a displayed reason string may lag by a beat but never causes a wrongful close.
- **Repeated cleanups before undo:** the undo stack holds only the last 3 cleanups — anything before that is not recoverable. Call this out in the UI rather than implying unlimited undo.
- **Service worker suspension:** ledger and undo state live in `storage.local` / `storage.session`, never in an in-memory variable, so a suspend/wake cycle loses nothing.
- **Post-restart staleness distortion:** all tabs restore near-simultaneously after a browser restart, which would otherwise make every tab look equally stale or fresh; the `onStartup` suppression flag accounts for this.
- **Tab ID reuse:** undo relies on stored metadata (url/pinned/window/index), never on assuming a live tabId still refers to the same tab.
- **Window/index precision:** best-effort only — see §9.1 Closer/undo module.

## 11. Open Questions / Deferred Decisions

1. **`downloads` permission:** keep only if an "active download" protection rule is added to §6; otherwise it stays dropped.
2. **Protection-list candidates not yet adopted:** generic `beforeunload` handlers, active camera/mic/screen-share, mid-navigation tabs, last-tab-in-window, recently-opened grace period. Revisit if early testing surfaces trust-damaging false positives in these categories.
3. **Popup vs. full review page:** resolved toward the review page as the primary triage surface — a popup's focus-loss teardown would destroy in-progress selection state at 40–100 rows. A toolbar popup, if added later, would be a lightweight launcher only, not part of the triage flow itself.

## 12. Risks

- **Undo fidelity expectations:** users may expect full page-state restoration (form contents, scroll position); copy must set expectations correctly to avoid eroding trust the first time it matters.
- **Form-detection heuristic is a heuristic, not a guarantee:** it's the first real trust test the extension will face.
- **Tab-group protection may rarely trigger:** many hoarders never use Chrome's native tab groups, so most protection load in practice falls on the active-tab / media / form / pinned checks, not group membership.
