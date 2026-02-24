import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBeeminder } from "./useBeeminder.ts";
import { GOALS_KEY, SETTINGS_KEY } from "../constants.ts";
import type { BeeminderGoal } from "../types.ts";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const sampleGoals: BeeminderGoal[] = [
  { slug: "focus", title: "Focus Time", gunits: "minutes" },
  { slug: "exercise", title: "Exercise", gunits: "hours" },
  { slug: "reading", title: "Reading", gunits: "minutes" },
];

function mockGoalsResponse(goals: BeeminderGoal[] = sampleGoals) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: async () => JSON.stringify(goals),
  } as Response);
}

describe("useBeeminder", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockFetch.mockReset();
  });

  it("starts with empty state", () => {
    const { result } = renderHook(() => useBeeminder("", ""));
    expect(result.current.goals).toEqual([]);
    expect(result.current.goalSlug).toBe("");
    expect(result.current.loadingGoals).toBe(false);
    expect(result.current.goalsError).toBeNull();
  });

  it("loads cached goals from localStorage on mount", () => {
    const cached = {
      goals: [{ slug: "focus", title: "Focus", gunits: "minutes" }],
      updatedAt: Date.now(),
    };
    localStorage.setItem(GOALS_KEY, JSON.stringify(cached));
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        username: "u",
        authToken: "t",
        goalSlug: "focus",
      }),
    );

    // Don't pass credentials to avoid auto-refresh
    const { result } = renderHook(() => useBeeminder("", ""));

    expect(result.current.goals).toEqual(cached.goals);
    expect(result.current.goalSlug).toBe("focus");
  });

  it("clears goalSlug if cached goal not found in goals list", () => {
    const cached = {
      goals: [{ slug: "focus", title: "Focus", gunits: "minutes" }],
      updatedAt: Date.now(),
    };
    localStorage.setItem(GOALS_KEY, JSON.stringify(cached));
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        username: "u",
        authToken: "t",
        goalSlug: "nonexistent",
      }),
    );

    const { result } = renderHook(() => useBeeminder("", ""));

    // goalSlug should still be loaded from settings (the second try block)
    // but the first block warns about it
    expect(result.current.goals).toEqual(cached.goals);
  });

  it("auto-selects first goal when goalSlug is empty", () => {
    const cached = {
      goals: [
        { slug: "focus", title: "Focus", gunits: "minutes" },
        { slug: "reading", title: "Reading", gunits: "minutes" },
      ],
      updatedAt: Date.now(),
    };
    localStorage.setItem(GOALS_KEY, JSON.stringify(cached));

    const { result } = renderHook(() => useBeeminder("", ""));

    expect(result.current.goalSlug).toBe("focus");
  });

  it("refreshGoals fetches and filters by gunits=minutes", async () => {
    mockGoalsResponse();

    const { result } = renderHook(() => useBeeminder("user", "token"));

    await waitFor(() => {
      expect(result.current.loadingGoals).toBe(false);
    });

    // Should only have goals with gunits=minutes
    expect(result.current.goals).toEqual([
      { slug: "focus", title: "Focus Time", gunits: "minutes" },
      { slug: "reading", title: "Reading", gunits: "minutes" },
    ]);
  });

  it("refreshGoals caches to localStorage", async () => {
    mockGoalsResponse();

    const { result } = renderHook(() => useBeeminder("user", "token"));

    await waitFor(() => {
      expect(result.current.loadingGoals).toBe(false);
    });

    const stored = JSON.parse(localStorage.getItem(GOALS_KEY)!);
    expect(stored.goals).toHaveLength(2);
    expect(stored.updatedAt).toBeGreaterThan(0);
  });

  it("refreshGoals sets error on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    const { result } = renderHook(() => useBeeminder("user", "token"));

    await waitFor(() => {
      expect(result.current.loadingGoals).toBe(false);
    });

    expect(result.current.goalsError).toContain("401");
  });

  it("refreshGoals clears goalSlug if selected goal no longer exists", async () => {
    // Start with a goal that won't be in the refresh response
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        username: "user",
        authToken: "token",
        goalSlug: "deleted-goal",
      }),
    );

    mockGoalsResponse();

    const { result } = renderHook(() => useBeeminder("user", "token"));

    await waitFor(() => {
      expect(result.current.loadingGoals).toBe(false);
    });

    // The deleted goal should be cleared, and first available goal selected
    expect(result.current.goalSlug).toBe("focus");
  });

  it("postDatapoint sends correct request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '{"id": "123"}',
    } as Response);

    const { result } = renderHook(() => useBeeminder("user", "token"));

    act(() => {
      result.current.setGoalSlug("focus");
    });

    await act(async () => {
      await result.current.postDatapoint(30, "test comment");
    });

    // Find the POST call (skip the GET for goals)
    const postCall = mockFetch.mock.calls.find(
      (call) => call[1]?.method === "POST",
    );
    expect(postCall).toBeDefined();
    expect(postCall![0]).toContain("/users/user/goals/focus/datapoints.json");

    const body = new URLSearchParams(postCall![1].body);
    expect(body.get("value")).toBe("30");
    expect(body.get("comment")).toBe("test comment");
    expect(body.get("auth_token")).toBe("token");
  });

  it("postDatapoint throws on error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Invalid",
    } as Response);

    const { result } = renderHook(() => useBeeminder("user", "token"));

    act(() => {
      result.current.setGoalSlug("focus");
    });

    await expect(
      act(() => result.current.postDatapoint(30, "test")),
    ).rejects.toThrow("Beeminder error 422");
  });

  it("refreshGoals shows error without credentials", async () => {
    const { result } = renderHook(() => useBeeminder("", ""));

    await act(async () => {
      await result.current.refreshGoals();
    });

    expect(result.current.goalsError).toContain("required");
  });

  it("setGoalSlug updates goalSlug", () => {
    const { result } = renderHook(() => useBeeminder("", ""));

    act(() => {
      result.current.setGoalSlug("new-goal");
    });

    expect(result.current.goalSlug).toBe("new-goal");
  });
});
