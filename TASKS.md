# Tasks

## Instructions for Claude

This file contains tasks to do. I will write these as I come up with ideas at work or at home, these are intended for you to do.

1. For each new task, create a Github issue. Add the issue to the task in an initial commit.
1. Create a pull request with the commits you make to solve a task. Link the issue on that PR.
1. Investigation results should go into the issue.
1. If you need a clarification from me, write it in the issue, and I will reply there.
1. For each task, once you finish it, check the appropriate mark in this document and close the issue.

## UX improvements

- [x] 1\. Dark mode — add a toggle that switches CSS custom properties and persists the preference to localStorage
- [x] 2\. Debounce YouTube title fetch — currently fires on every keystroke in the comment field; debounce by ~500ms
- [ ] 3\. Confirm before flush — flush immediately posts partial time with no confirmation, unlike cancel which prompts
- [x] 4\. Progress bar or ring — visual indicator of elapsed/remaining time alongside the numeric display
- [ ] 5\. Notification sound volume control — currently hardcoded to 0.7; add a slider or at least a mute toggle
- [x] 6\. Custom duration input — the editable timer display parses awkwardly (splits on `:`, ignores seconds); replace with a proper minutes input or a cleaner mm:ss parser
- [ ] 7\. Toast/flash messages instead of inline status — flushMessage and error disappear only on next action; auto-dismiss after a few seconds
- [ ] 8\. Keyboard shortcut hints — show that Space starts/pauses; consider adding shortcuts for flush (`f`) and cancel (`Esc`)
- [ ] 9\. Mobile responsiveness — duration buttons wrap poorly on narrow screens; test and fix layout at small viewports

## Reliability

- [ ] 10\. Retry on Beeminder post failure — currently goes straight to error state; offer a retry button or auto-retry once
- [ ] 11\. Validate auth token on save — ping the Beeminder API when saving settings so the user gets immediate feedback if credentials are wrong
- [ ] 12\. Handle stale deadline on page reload — if the browser was closed during a running timer, the persisted deadline is in the past; detect this and either auto-flush the elapsed time or prompt the user
- [x] 13\. Optimistic goalSlug persistence — the selected goal is only saved to localStorage when the user clicks the settings save button; save it on change so it survives reloads without explicit save

## Code quality

- [x] 14\. Remove `console.log` calls — currently scattered throughout hooks for debugging; strip them or gate behind a debug flag
- [x] 15\. Save goalSlug on selection change — `useBeeminder` manages goalSlug but doesn't persist it to `SETTINGS_KEY` when it changes, only when settings are explicitly saved
- [x] 16\. Add `useSettings` tests — the other two hooks have tests but useSettings does not
- [ ] 17\. Add integration/smoke test — render the full `<App />` component and verify the basic flow (select goal, start timer, see countdown)
- [ ] 18\. Strict `exhaustive-deps` — two eslint-disable comments suppress `react-hooks/exhaustive-deps`; refactor to eliminate them

## Features

- [ ] 19\. Session history — show a log of recently posted datapoints (stored locally or fetched from Beeminder)
- [ ] 20\. Multiple timer presets per goal — let users save named presets (e.g. "deep work 45m", "quick check 10m")
- [ ] 21\. Pomodoro mode — alternating focus/break intervals with configurable lengths
- [x] 22\. Offline queue — if the Beeminder post fails due to network, queue it and retry when connectivity returns (https://github.com/jpdarago/beeminder-timer/issues/1)
- [x] 23\. PWA / installable — add a service worker and manifest so the app can be installed and work offline
