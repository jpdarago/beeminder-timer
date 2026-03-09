import { useEffect, useState, useCallback } from "react";
import type { Status, StoredTimerState } from "../types.ts";
import { TIMER_STATE_KEY, POMODORO_BREAK } from "../constants.ts";
import { formatTime } from "../utils.ts";

const ding = new Audio("notification.mp3");

async function showNotification(title: string, options: NotificationOptions) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  try {
    // Prefer SW notifications (required on iOS PWAs), but don't await
    // navigator.serviceWorker.ready — it hangs if no SW is registered (e.g. dev mode).
    const registration =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
    if (registration?.active) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    // ignore — notification is best-effort
  }
}

export function loadPersistedTimerState(): StoredTimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (raw) return JSON.parse(raw) as StoredTimerState;
  } catch {
    // ignore
  }
  return null;
}

type UseTimerOptions = {
  selectedDuration: number;
  goalSlug: string;
  username: string;
  authToken: string;
  comment: string;
  volume: number;
  autoRenew: boolean;
  pomodoro: boolean;
  onComplete: () => Promise<void>;
  onFlush: (elapsed: number) => Promise<void>;
};

export function useTimer({
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
}: UseTimerOptions) {
  const [persisted] = useState(loadPersistedTimerState);
  const [remaining, setRemaining] = useState<number | null>(
    persisted?.remaining ?? null,
  );
  const [deadline, setDeadline] = useState<number | null>(
    persisted?.deadline ?? null,
  );
  const [status, setStatus] = useState<Status>(persisted?.status ?? "idle");
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(persisted?.paused ?? false);
  const [isBreak, setIsBreak] = useState(persisted?.isBreak ?? false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  const running = status === "running";

  // Change the tab title to show the timer
  useEffect(() => {
    if (remaining === null || remaining <= 0) {
      document.title = "Beeminder Timer";
      return;
    }

    const m = Math.floor(remaining / 60)
      .toString()
      .padStart(2, "0");
    const s = (remaining % 60).toString().padStart(2, "0");
    document.title = `${m}:${s} · Beeminder Timer`;
  }, [remaining]);

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
    }, 250);

    return () => window.clearInterval(id);
  }, [status, deadline]);

  // When timer reaches 0, post to Beeminder
  useEffect(() => {
    if (remaining !== 0 || status === "posting" || status === "finished")
      return;

    const playDing = () => {
      try {
        ding.volume = volume;
        ding.currentTime = 0;
        void ding.play();
      } catch {
        // ignore
      }
    };

    const startNewSession = (duration: number, breakMode: boolean) => {
      const now = Date.now();
      setStatus("running");
      setRemaining(duration);
      setDeadline(now + duration * 1000);
      setPaused(false);
      setIsBreak(breakMode);
      const timerState: StoredTimerState = {
        status: "running",
        remaining: duration,
        deadline: now + duration * 1000,
        paused: false,
        goalSlug,
        selectedDuration,
        comment,
        autoRenew: true,
        pomodoro,
        isBreak: breakMode,
      };
      localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timerState));
    };

    const doComplete = async () => {
      if (!username || !authToken || !goalSlug) {
        setStatus("error");
        setError("Username, auth token and goal slug are required.");
        return;
      }

      try {
        // Break just ended — start new work session without posting
        if (isBreak) {
          playDing();
          startNewSession(selectedDuration, false);
          return;
        }

        setStatus("posting");
        setError(null);

        await onComplete();
        playDing();

        void showNotification("Session complete!", {
          body: `Logged session for ${goalSlug} to Beeminder.`,
          icon: "bee.svg",
          silent: false,
          requireInteraction: false,
        });

        if (autoRenew && pomodoro) {
          startNewSession(POMODORO_BREAK, true);
        } else if (autoRenew) {
          startNewSession(selectedDuration, false);
        } else {
          setStatus("finished");
          localStorage.removeItem(TIMER_STATE_KEY);
        }
      } catch (e) {
        setStatus("error");
        setError((e as Error).message);
      }
    };

    doComplete();
  }, [remaining, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTimer = useCallback(() => {
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

    // Request notification permission from user gesture (required on iOS PWAs)
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    // Unlock audio for later programmatic playback (iOS requires first play in user gesture)
    try {
      ding.volume = 0;
      const p = ding.play();
      if (p)
        p.then(() => {
          ding.pause();
          ding.currentTime = 0;
          ding.volume = 1;
        }).catch(() => {});
    } catch {
      /* ignore — best-effort unlock */
    }

    setError(null);
    setFlushMessage(null);
    setStatus("running");
    setPaused(false);
    setIsBreak(false);
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
      autoRenew,
      pomodoro,
      isBreak: false,
    };
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timerState));
  }, [
    goalSlug,
    username,
    authToken,
    selectedDuration,
    comment,
    autoRenew,
    pomodoro,
  ]);

  const cancelTimer = useCallback(() => {
    if (
      !window.confirm(
        "Cancel the current session? Elapsed time will not be logged.",
      )
    )
      return;
    setDeadline(null);
    setRemaining(null);
    setStatus("idle");
    setPaused(false);
    setError(null);
    setFlushMessage(null);
    localStorage.removeItem(TIMER_STATE_KEY);
  }, []);

  const resetAfterFinish = useCallback(() => {
    setDeadline(null);
    setRemaining(null);
    setStatus("idle");
    setPaused(false);
    setError(null);
    setFlushMessage(null);
    localStorage.removeItem(TIMER_STATE_KEY);
  }, []);

  const togglePause = useCallback(() => {
    if (remaining === null) return;
    if (!paused) {
      setDeadline(null);
      setPaused(true);
    } else {
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
      autoRenew,
      pomodoro,
      isBreak,
    };
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timerState));
  }, [
    remaining,
    paused,
    status,
    deadline,
    goalSlug,
    selectedDuration,
    comment,
    autoRenew,
    pomodoro,
    isBreak,
  ]);

  const flushTimer = useCallback(async () => {
    if (
      remaining === null ||
      selectedDuration <= 0 ||
      !username ||
      !authToken ||
      !goalSlug
    )
      return;

    const elapsed = selectedDuration - remaining;
    if (elapsed <= 0) {
      setFlushMessage("No time elapsed to flush.");
      return;
    }

    try {
      setStatus("posting");
      setError(null);

      await onFlush(elapsed);

      try {
        ding.volume = volume;
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

      const value = elapsed / 60;
      setFlushMessage(`Logged ${value.toFixed(2)} minutes to Beeminder.`);

      void showNotification("Timer flushed!", {
        body: `Logged ${value.toFixed(2)} minutes for ${goalSlug} to Beeminder.`,
        icon: "bee.svg",
        silent: false,
        requireInteraction: false,
      });
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  }, [
    remaining,
    selectedDuration,
    username,
    authToken,
    goalSlug,
    volume,
    onFlush,
  ]);

  // Keyboard shortcuts: Space (start/pause), f (flush), Escape (cancel)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        if (!goalSlug || !username || !authToken || selectedDuration <= 0)
          return;
        if (status === "idle") {
          startTimer();
        } else if (status === "running" || paused) {
          togglePause();
        }
      } else if (event.key === "f" && status === "running") {
        event.preventDefault();
        flushTimer();
      } else if (event.key === "Escape" && status === "running") {
        event.preventDefault();
        cancelTimer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    goalSlug,
    username,
    authToken,
    selectedDuration,
    status,
    paused,
    startTimer,
    togglePause,
    flushTimer,
    cancelTimer,
  ]);

  const displayTime =
    remaining === null ? formatTime(selectedDuration) : formatTime(remaining);

  return {
    remaining,
    status,
    error,
    paused,
    running,
    isBreak,
    flushMessage,
    displayTime,
    startTimer,
    cancelTimer,
    resetAfterFinish,
    togglePause,
    flushTimer,
  };
}
