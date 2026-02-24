import { useEffect, useState } from "react";
import type { BeeminderGoal, StoredGoals, StoredSettings } from "../types.ts";
import { GOALS_KEY, GOAL_STALENESS_TIME, SETTINGS_KEY } from "../constants.ts";
import { postBeeminderDatapoint } from "../utils.ts";

function loadCachedGoals(): {
  goals: BeeminderGoal[];
  updatedAt: number | null;
  goalSlug: string;
} {
  let goals: BeeminderGoal[] = [];
  let updatedAt: number | null = null;
  let goalSlug = "";

  try {
    const rawGoals = localStorage.getItem(GOALS_KEY);
    if (rawGoals) {
      const parsed = JSON.parse(rawGoals) as StoredGoals;
      goals = parsed.goals ?? [];
      updatedAt = parsed.updatedAt ?? null;
    }
  } catch {
    // ignore
  }

  try {
    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      const settings = JSON.parse(rawSettings) as StoredSettings;
      const savedGoalSlug = settings.goalSlug ?? "";
      if (savedGoalSlug && goals.length > 0) {
        if (goals.some((goal) => goal.slug === savedGoalSlug)) {
          goalSlug = savedGoalSlug;
        } else {
          console.log(
            "Saved goal slug not found in goals list, clearing:",
            savedGoalSlug,
          );
        }
      }
    }
  } catch {
    // ignore
  }

  return { goals, updatedAt, goalSlug };
}

export function useBeeminder(username: string, authToken: string) {
  const [cached] = useState(loadCachedGoals);
  const [goals, setGoals] = useState<BeeminderGoal[]>(cached.goals);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [lastGoalsUpdate, setLastGoalsUpdate] = useState<number | null>(
    cached.updatedAt,
  );
  const [goalSlug, setGoalSlug] = useState(cached.goalSlug);

  // Auto-refresh goals if stale or never fetched
  useEffect(() => {
    if (!username || !authToken) return;

    const shouldRefresh =
      lastGoalsUpdate === null ||
      Date.now() - lastGoalsUpdate > GOAL_STALENESS_TIME;
    if (shouldRefresh) {
      refreshGoals();
    }
  }, [username, authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first goal if goalSlug is empty and we have goals
  useEffect(() => {
    if (!goalSlug && goals.length > 0) {
      setGoalSlug(goals[0].slug);
    }
  }, [goals, goalSlug]);

  // Persist goalSlug to settings whenever it changes
  useEffect(() => {
    if (!goalSlug) return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const settings = JSON.parse(raw) as StoredSettings;
        if (settings.goalSlug !== goalSlug) {
          settings.goalSlug = goalSlug;
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }
      }
    } catch {
      // ignore
    }
  }, [goalSlug]);

  const refreshGoals = async () => {
    if (!username || !authToken) {
      setGoalsError("Username and auth token are required to load goals.");
      return;
    }

    try {
      setLoadingGoals(true);
      setGoalsError(null);

      const endpoint = `https://www.beeminder.com/api/v1/users/${encodeURIComponent(
        username,
      )}/goals.json?auth_token=${encodeURIComponent(authToken)}`;

      console.log("Fetching goals from Beeminder:", { endpoint, username });

      const res = await fetch(endpoint);
      const text = await res.text();
      console.log("Beeminder goals response:", {
        status: res.status,
        body: text,
      });

      if (!res.ok) {
        throw new Error(`Beeminder goals error ${res.status}: ${text}`);
      }

      const parsed = JSON.parse(text) as BeeminderGoal[];
      const filteredGoals = parsed.filter((goal) => goal.gunits === "minutes");
      setGoals(filteredGoals);
      const now = Date.now();
      setLastGoalsUpdate(now);

      // Clear goalSlug if it no longer exists in the refreshed goals
      if (goalSlug && !filteredGoals.some((goal) => goal.slug === goalSlug)) {
        console.log(
          "Previously selected goal no longer exists, clearing:",
          goalSlug,
        );
        setGoalSlug("");
      }

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

  const postDatapoint = async (
    value: number,
    comment: string,
  ): Promise<void> => {
    console.log("Posting to Beeminder:", { value, comment, goalSlug });
    await postBeeminderDatapoint(
      username,
      authToken,
      goalSlug,
      value,
      comment,
      Math.floor(Date.now() / 1000),
    );
  };

  return {
    goals,
    loadingGoals,
    goalsError,
    lastGoalsUpdate,
    goalSlug,
    setGoalSlug,
    refreshGoals,
    postDatapoint,
  };
}
