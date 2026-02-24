# Beeminder Timer

A focus session timer that logs completed sessions to [Beeminder](https://www.beeminder.com/) as datapoints. Built with React 19, TypeScript, and Vite. Installable as a PWA.

## Features

- **Preset & custom durations** — 1, 5, 15, 25, or 30 minutes, or type a custom time
- **Beeminder integration** — posts minutes to any goal with `gunits = minutes`
- **Pause, cancel, flush** — flush ends a session early and logs only the elapsed time
- **Offline queue** — queues datapoints when offline and retries when connectivity returns
- **YouTube auto-titles** — paste a YouTube URL in the comment field and it fetches the video title
- **Keyboard shortcut** — Space to start or toggle pause (when no input is focused)
- **Notifications** — browser notification + audio ding on completion
- **Dark mode** — light / dark / system toggle
- **PWA** — installable on mobile, works offline, timer survives page reloads

## Development

Requires Node.js (22+). Uses [devenv](https://devenv.sh/) (Nix-based) for environment setup, but plain npm works too.

```sh
npm install
npm run dev        # Start Vite dev server
```

### Scripts

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm run dev`      | Start dev server               |
| `npm run build`    | Type-check + production build  |
| `npm test`         | Run tests (Vitest)             |
| `npm run lint`     | ESLint                         |
| `npm run lint:css` | Stylelint                      |
| `npm run format`   | Format all files with Prettier |

Pre-commit hooks (husky + lint-staged) auto-format and lint staged files on every commit.

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds and rsyncs to the production server. The app is served at the `/timer/` base path.

## Notification sound attribution

```
Message Notification 3 by AnthonyRox -- https://freesound.org/s/740422/ -- License: Creative Commons 0
```
