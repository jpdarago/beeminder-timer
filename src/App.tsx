import React, { useEffect, useState, useCallback } from "react";
import "./App.css";
import { THIRTY_MINUTES, durations } from "./constants.ts";
import { getYouTubeTitle } from "./utils.ts";
import { useSettings } from "./hooks/useSettings.ts";
import { useBeeminder } from "./hooks/useBeeminder.ts";
import { useTimer, loadPersistedTimerState } from "./hooks/useTimer.ts";

const App: React.FC = () => {
  const [persistedTimer] = useState(loadPersistedTimerState);
  const [selectedDuration, setSelectedDuration] = useState(
    persistedTimer?.selectedDuration ?? THIRTY_MINUTES
  );
  const [comment, setComment] = useState(persistedTimer?.comment ?? "");
  const [youtubeTitle, setYoutubeTitle] = useState<string | null>(null);

  const settings = useSettings();
  const { username, authToken } = settings;

  const beeminder = useBeeminder(username, authToken);
  const { goalSlug, goals } = beeminder;

  // Apply persisted goalSlug from timer state (overrides beeminder's default)
  useEffect(() => {
    if (persistedTimer?.goalSlug) {
      beeminder.setGoalSlug(persistedTimer.goalSlug);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onComplete = useCallback(async () => {
    const actualComment = comment.trim() || `${selectedDuration / 60}-minutes focus session`;
    await beeminder.postDatapoint(selectedDuration / 60, actualComment);
  }, [comment, selectedDuration, beeminder]);

  const onFlush = useCallback(async (elapsed: number) => {
    const value = elapsed / 60;
    const actualComment = `Flushed timer: ${value.toFixed(2)} minutes`;
    await beeminder.postDatapoint(value, actualComment);
  }, [beeminder]);

  const timer = useTimer({
    selectedDuration,
    goalSlug,
    username,
    authToken,
    comment,
    onComplete,
    onFlush,
  });

  // Fetch YouTube title if comment is a YouTube URL
  useEffect(() => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    getYouTubeTitle(trimmed).then(setYoutubeTitle);
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
            <p className="app-subtitle">Focus sessions, logged as datapoints.</p>
          </div>
        </div>
      </div>

      <section>

        <h2>Session</h2>

        <label>
          <b> Goal </b>
          <select
            value={goalSlug || (goals.length > 0 ? goals[0].slug : "")}
            onChange={e => beeminder.setGoalSlug(e.target.value)}
            disabled={timer.running || goals.length === 0}
          >
            {goals.length === 0 ? (
              <option value="">No goals loaded</option>
            ) : (
              goals.map(g => (
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

          {beeminder.goalsError && <div className="error-text">{beeminder.goalsError}</div>}


        </section>

      <section>
        <h2>Timer</h2>

        {timer.error && <div className="error-text">{timer.error}</div>}

        <div className="duration-buttons">
          {durations.map(duration => (
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
            onChange={e => setComment(e.target.value)}
            disabled={timer.running}
          />
        </label>
        {youtubeDisplay && <div className="youtube-title">YouTube Title: {youtubeDisplay}</div>}

        {timer.status === "idle" ? (
          <div>
            <input
              className="timer-display"
              type="text"
              min="1"
              value={`${selectedDuration / 60}:00`}
              onChange={e => {
                const value = e.target.value.split(":")[0];
                const minutes = parseInt(value) || 1;
                setSelectedDuration(minutes * 60);
              }}
            />
          </div>
        ) : (
          <div className="timer-display">{timer.displayTime}</div>
        )}

        {timer.flushMessage && <div className="status-text">{timer.flushMessage}</div>}

        {timer.status === "idle" && (
          <button className="btn btn-primary" onClick={timer.startTimer}>Start ⏱️</button>
        )}

        {timer.status === "running" && (
          <>
            <button className="btn btn-secondary" onClick={timer.togglePause}>
              {timer.paused ? "▶️" : "⏸️"}
              </button>
            <button className="btn btn-secondary" onClick={timer.cancelTimer}>❌</button>
            <button className="btn btn-secondary" onClick={timer.flushTimer}>📤</button>
          </>
        )}

        {(timer.status === "finished" ||
          timer.status === "posting" ||
          timer.status === "error") && (
            <button className="btn btn-secondary" onClick={timer.resetAfterFinish}>Reset</button>
          )}

      </section>

      <section>
        <h2>Beeminder settings</h2>

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
                onChange={e => settings.setUsername(e.target.value)}
                disabled={timer.running}
              />
            </label>

            <label>
              <input
                type="password"
                value={authToken}
                placeholder="Beeminder API token..."
                onChange={e => settings.setAuthToken(e.target.value)}
                disabled={timer.running}
              />
            </label>

            <button type="button" className="btn btn-secondary" onClick={() => settings.saveSettings(goalSlug)}>
              ✅
            </button>
          </>
        )}
      </section>
    </div>
  );
};

export default App;
