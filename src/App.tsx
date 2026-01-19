import React, { useEffect, useState } from "react";
import "./App.css";

const THIRTY_MINUTES = 30 * 60; // seconds

const ding = new Audio("notification.mp3");
ding.volume = 0.7;

type Status = "idle" | "running" | "posting" | "finished" | "error";

type BeeminderGoal = {
  slug: string;
  title?: string;
  gunits?: string;
};

type StoredSettings = {
  username: string;
  authToken: string;
  goalSlug: string;
};

type StoredGoals = {
  goals: BeeminderGoal[];
  updatedAt: number; // unix timestamp ms
};

const SETTINGS_KEY = "beeminderTimerSettings";
const GOALS_KEY = "beeminderTimerGoals";
const TIMER_STATE_KEY = "beeminderTimerState";

type StoredTimerState = {
  status: Status;
  remaining: number;
  deadline: number | null;
  paused: boolean;
  goalSlug: string;
  selectedDuration: number;
  comment: string;
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const getYouTubeTitle = async (url: string): Promise<string | null> => {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/)watch\?v=(.*)(?:&.*)?/);
  if (!match) return null;
  const videoId = match[1];
  console.log('Fetching YouTube title for video ID:', videoId);
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return data.title;
    }
  } catch (e) {
    console.error('Failed to fetch YouTube title:', e);
  }
  return null;
};

const App: React.FC = () => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const [paused, setPaused] = useState(false);

  const [username, setUsername] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [goalSlug, setGoalSlug] = useState("");
  const [comment, setComment] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState<string | null>(null);

  const [goals, setGoals] = useState<BeeminderGoal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [lastGoalsUpdate, setLastGoalsUpdate] = useState<number | null>(null);

  const [hasStoredSettings, setHasStoredSettings] = useState(false);
  const [showSettingsForm, setShowSettingsForm] = useState(true);

  const [selectedDuration, setSelectedDuration] = useState(THIRTY_MINUTES);

  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  const durations = [5, 10, 20, 30, 45, 60]; // minutes

  const running = status === "running";

  // Load saved settings + goals from localStorage
  useEffect(() => {
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as StoredSettings;
        const loadedUsername = parsed.username ?? "";
        const loadedToken = parsed.authToken ?? "";
        const loadedGoalSlug = parsed.goalSlug ?? "";

        setUsername(loadedUsername);
        setAuthToken(loadedToken);
        setGoalSlug(loadedGoalSlug);

        if (loadedUsername && loadedToken) {
          setHasStoredSettings(true);
          setShowSettingsForm(false); // hide form by default if settings exist
        }
      }
    } catch {
      // ignore
    }

    try {
      const rawGoals = localStorage.getItem(GOALS_KEY);
      if (rawGoals) {
        const parsed = JSON.parse(rawGoals) as StoredGoals;
        setGoals(parsed.goals ?? []);
        setLastGoalsUpdate(parsed.updatedAt ?? null);
      }
    } catch {
      // ignore
    }

    try {
      const rawTimerState = localStorage.getItem(TIMER_STATE_KEY);
      if (rawTimerState) {
        const parsed = JSON.parse(rawTimerState) as StoredTimerState;
        setStatus(parsed.status);
        setRemaining(parsed.remaining);
        setDeadline(parsed.deadline);
        setPaused(parsed.paused);
        setGoalSlug(parsed.goalSlug || "");
        setSelectedDuration(parsed.selectedDuration || 0);
        setComment(parsed.comment || "");
      }
    } catch {
      // ignore
    }
  }, []);

  // Change the tab title to show the timer
  useEffect(() => {
    // When there's no timer running, show the default title
    if (remaining === null || remaining <= 0) {
      document.title = "Beeminder Timer";
      return;
    }

    // Format the time like 25:03 or 00:17
    const m = Math.floor(remaining / 60).toString().padStart(2, "0");
    const s = (remaining % 60).toString().padStart(2, "0");

    document.title = `${m}:${s} · Beeminder Timer`;
  }, [remaining]);

  // Ask for notification permission once
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fetch YouTube title if comment is a YouTube URL
  useEffect(() => {
    if (comment.trim()) {
      getYouTubeTitle(comment.trim()).then(setYoutubeTitle);
    } else {
      setYoutubeTitle(null);
    }
  }, [comment]);

  // Countdown effect with pause support
  useEffect(() => {
    if (status !== "running" || deadline === null) return;

    const id = window.setInterval(() => {
      const msLeft = deadline - Date.now();
      const secsLeft = Math.max(0, Math.round(msLeft / 1000));
      setRemaining(secsLeft);
      if (secsLeft <= 0) {
        window.clearInterval(id);
      }
    }, 250); // 4x per second; drift-free because we recompute from deadline

    return () => window.clearInterval(id);
  }, [status, deadline]);

  // When timer reaches 0, call Beeminder directly
  useEffect(() => {
    if (remaining !== 0 || status === "posting" || status === "finished") return;

    if (!username || !authToken || !goalSlug) {
      setStatus("error");
      setError("Username, auth token and goal slug are required.");
      return;
    }

    const postToBeeminder = async () => {
      try {
        setStatus("posting");
        setError(null);

        const endpoint = `https://www.beeminder.com/api/v1/users/${encodeURIComponent(
          username
        )}/goals/${encodeURIComponent(goalSlug)}/datapoints.json`;

        const actualComment = comment.trim() || `${selectedDuration / 60}-minutes focus session`;

        const params = new URLSearchParams({
          auth_token: authToken,
          value: (selectedDuration / 60).toString(),
          comment: actualComment,
          timestamp: Math.floor(Date.now() / 1000).toString(),
        });

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const text = await res.text();

        if (!res.ok) {
          throw new Error(`Beeminder error ${res.status}: ${text}`);
        }

        try {
          ding.currentTime = 0;
          void ding.play();
        } catch {
          // ignore
        }

        setStatus("finished");

        localStorage.removeItem(TIMER_STATE_KEY);

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Session complete!", {
            body: `Logged session for ${goalSlug} to Beeminder.`,
            icon: "bee.svg",
            silent: false,
            requireInteraction: false
          });
        }
      } catch (e) {
        setStatus("error");
        setError((e as Error).message);
      }
    };

    postToBeeminder();
  }, [remaining, status, username, authToken, goalSlug, comment, selectedDuration]);

  const startTimer = () => {
    if (!goalSlug) {
      setStatus("error");
      setError("You must select a goal first.");
      return;
    }
    if (!username || !authToken) {
      setStatus("error");
      setError("Username and auth token are required to start.");
      return;
    }
    setError(null);
    setFlushMessage(null);
    setStatus("running");
    setPaused(false);
    setRemaining(selectedDuration);
    const now = Date.now();
    setDeadline(now + selectedDuration * 1000);

    const timerState: StoredTimerState = {
      status: "running",
      remaining: selectedDuration,
      deadline: now + selectedDuration * 1000,
      paused: false,
      goalSlug,
      selectedDuration,
      comment,
    };
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timerState));
  };

  const cancelTimer = () => {
    setDeadline(null);
    setRemaining(null);
    setStatus("idle");
    setPaused(false);
    setError(null);
    setFlushMessage(null);
    localStorage.removeItem(TIMER_STATE_KEY);
  };

  const resetAfterFinish = () => {
    setDeadline(null);
    setRemaining(null);
    setStatus("idle");
    setPaused(false);
    setError(null);
    setFlushMessage(null);
    localStorage.removeItem(TIMER_STATE_KEY);
  };

  const togglePause = () => {
    if (remaining === null) return;
    if (!paused) {
      // pause: freeze remaining, drop deadline
      setDeadline(null);
      setPaused(true);
    } else {
      // resume: set new deadline based on remaining
      const now = Date.now();
      setDeadline(now + remaining * 1000);
      setPaused(false);
    }

    const timerState: StoredTimerState = {
      status,
      remaining: remaining!,
      deadline,
      paused: !paused,
      goalSlug,
      selectedDuration,
      comment,
    };
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timerState));
  };

  const flushTimer = async () => {
    if (remaining === null || selectedDuration <= 0 || !username || !authToken || !goalSlug) return;

    const elapsed = selectedDuration - remaining;
    if (elapsed <= 0) {
      setFlushMessage("No time elapsed to flush.");
      return;
    }

    try {
      setStatus("posting");
      setError(null);

      const endpoint = `https://www.beeminder.com/api/v1/users/${encodeURIComponent(
        username
      )}/goals/${encodeURIComponent(goalSlug)}/datapoints.json`;

      const value = elapsed / 60;
      const actualComment = `Flushed timer: ${value.toFixed(2)} minutes`;

      const params = new URLSearchParams({
        auth_token: authToken,
        value: value.toString(),
        comment: actualComment,
        timestamp: Math.floor(Date.now() / 1000).toString(),
      });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(`Beeminder error ${res.status}: ${text}`);
      }

      try {
        ding.currentTime = 0;
        void ding.play();
      } catch {
        // ignore
      }

      setDeadline(null);
      setRemaining(null);
      setStatus("idle");
      setPaused(false);
      localStorage.removeItem(TIMER_STATE_KEY);

      setFlushMessage(`Logged ${value.toFixed(2)} minutes to Beeminder.`);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Timer flushed!", {
          body: `Logged ${value.toFixed(2)} minutes for ${goalSlug} to Beeminder.`,
          icon: "bee.svg",
          silent: false,
          requireInteraction: false
        });
      }
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  };

  // Keyboard shortcut for space bar to start/stop timer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        // Don't intercept space if an input or textarea is focused
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          return;
        }

        event.preventDefault();
        if (!goalSlug || !username || !authToken || selectedDuration <= 0) return;
        if (status === 'idle') {
          startTimer();
        } else if (status === 'running' || paused) {
          togglePause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goalSlug, username, authToken, selectedDuration, status, paused, startTimer, togglePause]);

  const saveSettings = () => {
    const settings: StoredSettings = { username, authToken, goalSlug };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (username && authToken) {
      setHasStoredSettings(true);
      setShowSettingsForm(false);
    }
  };

  const displayTime =
    remaining === null ? formatTime(selectedDuration) : formatTime(remaining);

  // Fetch goals from Beeminder and cache locally
  const refreshGoals = async () => {
    if (!username || !authToken) {
      setGoalsError("Username and auth token are required to load goals.");
      return;
    }

    try {
      setLoadingGoals(true);
      setGoalsError(null);

      const endpoint = `https://www.beeminder.com/api/v1/users/${encodeURIComponent(
        username
      )}/goals.json?auth_token=${encodeURIComponent(authToken)}`;

      const res = await fetch(endpoint);
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`Beeminder goals error ${res.status}: ${text}`);
      }

      const parsed = JSON.parse(text) as BeeminderGoal[];
      const filteredGoals = parsed.filter(goal => goal.gunits === 'minutes');
      setGoals(filteredGoals);
      const now = Date.now();
      setLastGoalsUpdate(now);

      const toStore: StoredGoals = {
        goals: filteredGoals,
        updatedAt: now,
      };
      localStorage.setItem(GOALS_KEY, JSON.stringify(toStore));

      if (!goalSlug && filteredGoals.length > 0) {
        setGoalSlug(filteredGoals[0].slug);
      }
    } catch (e) {
      setGoalsError((e as Error).message);
    } finally {
      setLoadingGoals(false);
    }
  };

  const lastUpdateLabel =
    lastGoalsUpdate != null
      ? new Date(lastGoalsUpdate).toLocaleString()
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
            value={goalSlug}
            onChange={e => setGoalSlug(e.target.value)}
            disabled={running || goals.length === 0}
          >
            <option value="">
              {goals.length === 0 ? "No goals loaded" : "Select a goal…"}
            </option>
            {goals.map(g => (
              <option key={g.slug} value={g.slug}>
                {(g.title ?? g.slug) + " (" + g.slug + ")"}
              </option>
              ))}
            </select>
          </label>

          <div className="status-text">Last updated: {lastUpdateLabel}</div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={refreshGoals}
            disabled={running || loadingGoals}
            aria-label="Refresh goals from Beeminder"
          >
            Refresh goals 🔄
          </button>

          {goalsError && <div className="error-text">{goalsError}</div>}


        </section>

      <section>
        <h2>Timer</h2>

        {error && <div className="error-text">{error}</div>}

        <div className="duration-buttons">
          {durations.map(duration => (
            <button
              key={duration}
              className="btn btn-secondary"
              onClick={() => setSelectedDuration(duration * 60)}
              disabled={running}
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
            disabled={running}
          />
        </label>
        {youtubeTitle && <div className="youtube-title">YouTube Title: {youtubeTitle}</div>}

        {status === "idle" ? (
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
          <div className="timer-display">{displayTime}</div>
        )}

        {flushMessage && <div className="status-text">{flushMessage}</div>}

        {status === "idle" && (
          <button className="btn btn-primary" onClick={startTimer}>Start ⏱️</button>
        )}

        {status === "running" && (
          <>
            <button className="btn btn-secondary" onClick={togglePause}>
              {paused ? "▶️" : "⏸️"}
              </button>
            <button className="btn btn-secondary" onClick={cancelTimer}>❌</button>
            <button className="btn btn-secondary" onClick={flushTimer}>📤</button>
          </>
        )}

        {(status === "finished" ||
          status === "posting" ||
          status === "error") && (
            <button className="btn btn-secondary" onClick={resetAfterFinish}>Reset</button>
          )}

      </section>

      <section>
        <h2>Beeminder settings</h2>

        {hasStoredSettings && !showSettingsForm && (
          <>
            <div className="status-text">
              Using stored settings for user <code>{username}</code>.
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowSettingsForm(true)}
              disabled={running}
            >
              ✏️ Edit settings
            </button>
          </>
        )}

        {(!hasStoredSettings || showSettingsForm) && (
          <>
            <label>
              <input
                type="text"
                value={username}
                placeholder="Username..."
                onChange={e => setUsername(e.target.value)}
                disabled={running}
              />
            </label>

            <label>
              <input
                type="password"
                value={authToken}
                placeholder="Beeminder API token..."
                onChange={e => setAuthToken(e.target.value)}
                disabled={running}
              />
            </label>

            <button type="button" className="btn btn-secondary" onClick={saveSettings}>
              ✅
            </button>
          </>
        )}
      </section>
    </div>
  );
};

export default App;
