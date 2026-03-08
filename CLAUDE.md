# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — type-check with `tsc -b` then build with Vite
- `npm run lint` — run ESLint
- `npm run preview` — preview production build

Dev environment uses devenv (Nix-based) with Node.js and npm.

## Architecture

Single-page React 19 app (TypeScript, Vite) that times focus sessions and posts datapoints to the Beeminder API. Deployed at `/timer/` base path.

The entire app lives in **`src/App.tsx`** — one `App` component with all state, effects, and API calls inline. There are no separate components, hooks, services, or state management libraries.

### Key concepts

- **Timer states**: `idle` → `running` → `posting` → `finished` (or `error`). Timer uses a deadline-based approach (compares `Date.now()` against a stored deadline) rather than decrementing, so it's drift-free.
- **Beeminder integration**: Posts datapoints directly to `POST /api/v1/users/:user/goals/:goal/datapoints.json`. Goals are fetched and filtered to only show goals with `gunits === 'minutes'`.
- **Persistence**: Three localStorage keys (`beeminderTimerSettings`, `beeminderTimerGoals`, `beeminderTimerState`) store credentials, cached goals (with 24h staleness), and in-progress timer state (survives page reload).
- **Flush**: Lets the user end a timer early and log only the elapsed portion.
- **Comment field**: Accepts free text; if a YouTube URL is pasted, it auto-fetches the video title via oEmbed.
- **Keyboard shortcut**: Space bar starts timer (when idle) or toggles pause (when running), unless an input is focused.
- **Notifications**: Browser notification + audio ding (`notification.mp3`) on completion.

## Privacy

Never persist personal information (names, emails, addresses, personal identifiers) to memory files or any other persistent storage. This includes data encountered in code, configs, issues, or conversations.
