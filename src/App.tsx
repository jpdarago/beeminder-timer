import React, { useEffect, useState, useCallback } from "react";
import "./App.css";
import { THIRTY_MINUTES, POMODORO_BREAK, durations } from "./constants.ts";
import { getYouTubeTitle, NetworkError } from "./utils.ts";
import { useSettings } from "./hooks/useSettings.ts";
import { useBeeminder } from "./hooks/useBeeminder.ts";
import { useTimer, loadPersistedTimerState } from "./hooks/useTimer.ts";
import { useOfflineQueue } from "./hooks/useOfflineQueue.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { useVolume } from "./hooks/useVolume.ts";

const App: React.FC = () => {
  const [persistedTimer] = useState(loadPersistedTimerState);
  const [selectedDuration, setSelectedDuration] = useState(
    persistedTimer?.selectedDuration ?? THIRTY_MINUTES,
  );
  const [comment, setComment] = useState(persistedTimer?.comment ?? "");
  const [autoRenew, setAutoRenew] = useState(
    persistedTimer?.autoRenew ?? false,
  );
  const [pomodoro, setPomodoro] = useState(persistedTimer?.pomodoro ?? false);
  const [youtubeTitle, setYoutubeTitle] = useState<string | null>(null);

  const { themePreference, setThemePreference } = useTheme();
  const { volume, setVolume } = useVolume();

  const settings = useSettings();
  const { username, authToken } = settings;

  const beeminder = useBeeminder(username, authToken);
  const { goalSlug, goals } = beeminder;
  const offlineQueue = useOfflineQueue(username, authToken);

  // Apply persisted goalSlug from timer state (overrides beeminder's default)
  useEffect(() => {
    if (persistedTimer?.goalSlug) {
      beeminder.setGoalSlug(persistedTimer.goalSlug);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onComplete = useCallback(async () => {
    const actualComment =
      comment.trim() || `${selectedDuration / 60}-minutes focus session`;
    try {
      await beeminder.postDatapoint(selectedDuration / 60, actualComment);
    } catch (e) {
      if (e instanceof NetworkError) {
        offlineQueue.enqueue({
          goalSlug,
          value: selectedDuration / 60,
          comment: actualComment,
          timestamp: Math.floor(Date.now() / 1000),
          queuedAt: Date.now(),
        });
        return; // Don't rethrow — timer transitions to "finished"
      }
      throw e;
    }
  }, [comment, selectedDuration, beeminder, goalSlug, offlineQueue]);

  const onFlush = useCallback(
    async (elapsed: number) => {
      const value = elapsed / 60;
      const actualComment = `Flushed timer: ${value.toFixed(2)} minutes`;
      try {
        await beeminder.postDatapoint(value, actualComment);
      } catch (e) {
        if (e instanceof NetworkError) {
          offlineQueue.enqueue({
            goalSlug,
            value,
            comment: actualComment,
            timestamp: Math.floor(Date.now() / 1000),
            queuedAt: Date.now(),
          });
          return;
        }
        throw e;
      }
    },
    [beeminder, goalSlug, offlineQueue],
  );

  const timer = useTimer({
    selectedDuration,
    goalSlug,
    username,
    authToken,
    comment,
    volume,
    autoRenew,
    pomodoro,
    onComplete,
    onFlush,
  });

  // Fetch YouTube title if comment is a YouTube URL (debounced 200ms)
  useEffect(() => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    const id = setTimeout(() => {
      getYouTubeTitle(trimmed).then(setYoutubeTitle);
    }, 200);
    return () => clearTimeout(id);
  }, [comment]);

  // Clear YouTube title when comment is cleared (separate to avoid set-state-in-effect)
  const youtubeDisplay = comment.trim() ? youtubeTitle : null;

  const lastUpdateLabel =
    beeminder.lastGoalsUpdate != null
      ? new Date(beeminder.lastGoalsUpdate).toLocaleString()
      : "never";

  return (
    <div className="app-wrapper">
      <div className="app-header-banner">
        <div className="app-header">
          <img src="bee.svg" alt="Bee timer logo" className="app-logo" />
          <div className="app-heading">
            <h1 className="app-title">Beeminder Timer</h1>
            <p className="app-subtitle">
              Focus sessions, logged as datapoints.
            </p>
          </div>
        </div>
      </div>

      <section>
        <h2>Session</h2>

        <label>
          <b> Goal </b>
          <select
            value={goalSlug || (goals.length > 0 ? goals[0].slug : "")}
            onChange={(e) => beeminder.setGoalSlug(e.target.value)}
            disabled={timer.running || goals.length === 0}
          >
            {goals.length === 0 ? (
              <option value="">No goals loaded</option>
            ) : (
              goals.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {(g.title ?? g.slug) + " (" + g.slug + ")"}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="status-text">Last updated: {lastUpdateLabel}</div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={beeminder.refreshGoals}
          disabled={timer.running || beeminder.loadingGoals}
          aria-label="Refresh goals from Beeminder"
        >
          Refresh goals 🔄
        </button>

        {beeminder.goalsError && (
          <div className="error-text">{beeminder.goalsError}</div>
        )}
      </section>

      <section>
        <h2>Timer</h2>

        {timer.error && <div className="error-text">{timer.error}</div>}

        <div className="duration-buttons">
          {durations.map((duration) => (
            <button
              key={duration}
              className="btn btn-secondary"
              onClick={() => setSelectedDuration(duration * 60)}
              disabled={timer.running}
            >
              {duration} min
            </button>
          ))}
        </div>

        <label>
          <b> Comment</b>
          <input
            type="text"
            value={comment}
            placeholder={`${selectedDuration / 60}-minutes focus session`}
            onChange={(e) => setComment(e.target.value)}
            disabled={timer.running}
          />
        </label>
        {youtubeDisplay && (
          <div className="youtube-title">YouTube Title: {youtubeDisplay}</div>
        )}

        <div className="toggle-buttons">
          <button
            className={`btn btn-toggle ${autoRenew ? "active" : ""}`}
            onClick={() => setAutoRenew((v) => !v)}
            title="Auto-renew session"
          >
            🔁
          </button>
          <button
            className={`btn btn-toggle ${pomodoro ? "active" : ""}`}
            onClick={() => setPomodoro((v) => !v)}
            title="Pomodoro mode (5-min breaks)"
          >
            🍅
          </button>
        </div>

        {timer.status === "idle" ? (
          <div className="duration-input-wrapper">
            <input
              className="timer-display"
              type="number"
              min="1"
              max="999"
              value={selectedDuration / 60}
              onChange={(e) => {
                const minutes = Math.max(1, parseInt(e.target.value) || 1);
                setSelectedDuration(minutes * 60);
              }}
            />
            <span className="duration-unit">minutes</span>
          </div>
        ) : (
          <>
            {timer.isBreak && <div className="break-indicator">☕ Break</div>}
            <div className="progress-ring-wrapper">
              <svg className="progress-ring" viewBox="0 0 120 120">
                <circle className="progress-ring-bg" cx="60" cy="60" r="54" />
                <circle
                  className="progress-ring-fill"
                  cx="60"
                  cy="60"
                  r="54"
                  strokeDasharray={2 * Math.PI * 54}
                  strokeDashoffset={
                    2 *
                    Math.PI *
                    54 *
                    (timer.remaining !== null
                      ? timer.remaining /
                        (timer.isBreak ? POMODORO_BREAK : selectedDuration)
                      : 1)
                  }
                />
              </svg>
              <div className="timer-display">{timer.displayTime}</div>
            </div>
          </>
        )}

        {timer.flushMessage && (
          <div className="status-text">{timer.flushMessage}</div>
        )}

        {timer.status === "idle" && (
          <button className="btn btn-primary" onClick={timer.startTimer}>
            Start ⏱️
            <span className="shortcut-hint">Space</span>
          </button>
        )}

        {timer.status === "running" && (
          <div className="timer-actions">
            <button className="btn btn-secondary" onClick={timer.togglePause}>
              {timer.paused ? "▶️" : "⏸️"}
              <span className="shortcut-hint">Space</span>
            </button>
            <button className="btn btn-secondary" onClick={timer.cancelTimer}>
              ❌<span className="shortcut-hint">Esc</span>
            </button>
            <button className="btn btn-secondary" onClick={timer.flushTimer}>
              📤
              <span className="shortcut-hint">F</span>
            </button>
          </div>
        )}

        {(timer.status === "finished" ||
          timer.status === "posting" ||
          timer.status === "error") && (
          <button
            className="btn btn-secondary"
            onClick={timer.resetAfterFinish}
          >
            Reset
          </button>
        )}
      </section>

      {offlineQueue.queue.length > 0 && (
        <section>
          <div className="status-text">
            {offlineQueue.queue.length} datapoint
            {offlineQueue.queue.length !== 1 ? "s" : ""} pending
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={offlineQueue.processQueue}
          >
            Retry now
          </button>
        </section>
      )}

      <section>
        <details className="settings-details">
          <summary>
            <h2>⚙️ Settings</h2>
          </summary>

          {settings.hasStoredSettings && !settings.showSettingsForm && (
            <>
              <div className="status-text">
                Using stored settings for user <code>{username}</code>.
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => settings.setShowSettingsForm(true)}
                disabled={timer.running}
              >
                ✏️ Edit settings
              </button>
            </>
          )}

          {(!settings.hasStoredSettings || settings.showSettingsForm) && (
            <>
              <label>
                <input
                  type="text"
                  value={username}
                  placeholder="Username..."
                  onChange={(e) => settings.setUsername(e.target.value)}
                  disabled={timer.running || settings.validating}
                />
              </label>

              <label>
                <input
                  type="password"
                  value={authToken}
                  placeholder="Beeminder API token..."
                  onChange={(e) => settings.setAuthToken(e.target.value)}
                  disabled={timer.running || settings.validating}
                />
              </label>

              {settings.validationError && (
                <div className="error-text">{settings.validationError}</div>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => settings.saveSettings(goalSlug)}
                disabled={settings.validating}
              >
                {settings.validating ? "Validating…" : "✅"}
              </button>
            </>
          )}
          <label>
            <b>Theme</b>
            <select
              value={themePreference}
              onChange={(e) =>
                setThemePreference(
                  e.target.value as "system" | "light" | "dark",
                )
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <label>
            <b>Volume</b>
            <div className="volume-control">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
              />
              <span className="volume-label">
                {volume === 0 ? "Muted" : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </label>
        </details>
      </section>
    </div>
  );
};

export default App;
