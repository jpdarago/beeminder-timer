import React, { useEffect, useState } from "react";
import "./App.css";

const THIRTY_MINUTES = 30 * 60; // seconds

type Status = "idle" | "running" | "posting" | "finished" | "error";

type BeeminderGoal = {
  slug: string;
  title?: string;
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

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const App: React.FC = () => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const [paused, setPaused] = useState(false);

  const [username, setUsername] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [goalSlug, setGoalSlug] = useState("");
  const [comment, setComment] = useState("30-minute focus session");

  const [goals, setGoals] = useState<BeeminderGoal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [lastGoalsUpdate, setLastGoalsUpdate] = useState<number | null>(null);

  const [hasStoredSettings, setHasStoredSettings] = useState(false);
  const [showSettingsForm, setShowSettingsForm] = useState(true);

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

  // Countdown effect with pause support
  useEffect(() => {
    if (remaining === null || remaining <= 0 || paused) return;

    const id = window.setInterval(() => {
      setRemaining(prev => {
        if (prev === null) return prev;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [remaining, paused]);

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

        const params = new URLSearchParams({
          auth_token: authToken,
          value: "1",
          comment,
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

        setStatus("finished");

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Session complete!", {
            body: "Your 30-minute session has been logged to Beeminder.",
            icon: "/favicon.ico",
          });
        }
      } catch (e) {
        setStatus("error");
        setError((e as Error).message);
      }
    };

    postToBeeminder();
  }, [remaining, status, username, authToken, goalSlug, comment]);

  const startTimer = () => {
    if (!username || !authToken || !goalSlug) {
      setStatus("error");
      setError("Username, auth token and goal slug are required to start.");
      return;
    }
    setError(null);
    setStatus("running");
    setPaused(false);
    setRemaining(THIRTY_MINUTES);
  };

  const cancelTimer = () => {
    setRemaining(null);
    setStatus("idle");
    setPaused(false);
    setError(null);
  };

  const resetAfterFinish = () => {
    setRemaining(null);
    setStatus("idle");
    setPaused(false);
    setError(null);
  };

  const saveSettings = () => {
    const settings: StoredSettings = { username, authToken, goalSlug };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (username && authToken) {
      setHasStoredSettings(true);
      setShowSettingsForm(false);
    }
  };

  const displayTime =
    remaining === null ? formatTime(THIRTY_MINUTES) : formatTime(remaining);

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
      setGoals(parsed);
      const now = Date.now();
      setLastGoalsUpdate(now);

      const toStore: StoredGoals = {
        goals: parsed,
        updatedAt: now,
      };
      localStorage.setItem(GOALS_KEY, JSON.stringify(toStore));

      if (!goalSlug && parsed.length > 0) {
        setGoalSlug(parsed[0].slug);
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
      <h1 className="app-title">Beeminder 30-Min Timer</h1>

      <h2>Session</h2>

      <section>
        <button
          type="button"
          onClick={refreshGoals}
          disabled={running || loadingGoals}
          aria-label="Refresh goals from Beeminder"
        >
          Refresh goals 🔄
        </button>

        <div className="status-text">Last updated: {lastUpdateLabel}</div>

        {goalsError && <div className="error-text">{goalsError}</div>}

        <label>
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
        </section>

        <section>
          <label>
            Comment:
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              disabled={running}
            />
          </label>
        </section>

      <section>
        <h2>Timer</h2>

        <div className="timer-display">{displayTime}</div>

        {status === "idle" && (
          <button onClick={startTimer}>Start ⏱️</button>
        )}

        {status === "running" && (
          <>
            <button onClick={() => setPaused(p => !p)}>
              {paused ? "Resume ▶️" : "Pause ⏸️"}
              </button>
            <button onClick={cancelTimer}>Cancel ❌</button>
          </>
        )}

        {(status === "finished" ||
          status === "posting" ||
          status === "error") && (
            <button onClick={resetAfterFinish}>Reset</button>
          )}

        {error && <div className="error-text">{error}</div>}
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
              Username:
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={running}
              />
            </label>

            <label>
              Auth token:
              <input
                type="password"
                value={authToken}
                onChange={e => setAuthToken(e.target.value)}
                disabled={running}
              />
            </label>

            <button type="button" onClick={saveSettings}>
              Save settings locally
            </button>

            {hasStoredSettings && (
              <button
                type="button"
                onClick={() => setShowSettingsForm(false)}
                disabled={running}
              >
                ✅ Done
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default App;
