import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimer } from "./useTimer.ts";
import { TIMER_STATE_KEY, POMODORO_BREAK } from "../constants.ts";

// Mock Audio
vi.stubGlobal(
  "Audio",
  vi.fn(() => ({
    volume: 0,
    currentTime: 0,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  })),
);

// Mock Notification
vi.stubGlobal(
  "Notification",
  Object.assign(vi.fn(), {
    permission: "granted",
    requestPermission: vi.fn().mockResolvedValue("granted"),
  }),
);

function makeOptions(overrides: Partial<Parameters<typeof useTimer>[0]> = {}) {
  return {
    selectedDuration: 1800, // 30 minutes
    goalSlug: "test-goal",
    username: "testuser",
    authToken: "testtoken",
    comment: "",
    volume: 0.7,
    autoRenew: false,
    pomodoro: false,
    onComplete: vi.fn().mockResolvedValue(undefined),
    onFlush: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as Parameters<typeof useTimer>[0];
}

describe("useTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    document.title = "Beeminder Timer";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useTimer(makeOptions()));
    expect(result.current.status).toBe("idle");
    expect(result.current.running).toBe(false);
    expect(result.current.paused).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.flushMessage).toBeNull();
  });

  it("displays formatted time from selectedDuration when idle", () => {
    const { result } = renderHook(() =>
      useTimer(makeOptions({ selectedDuration: 600 })),
    );
    expect(result.current.displayTime).toBe("10:00");
  });

  it("starts timer and transitions to running", () => {
    const { result } = renderHook(() => useTimer(makeOptions()));

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.status).toBe("running");
    expect(result.current.running).toBe(true);
    expect(result.current.paused).toBe(false);
  });

  it("persists timer state to localStorage on start", () => {
    const { result } = renderHook(() => useTimer(makeOptions()));

    act(() => {
      result.current.startTimer();
    });

    const stored = JSON.parse(localStorage.getItem(TIMER_STATE_KEY)!);
    expect(stored.status).toBe("running");
    expect(stored.goalSlug).toBe("test-goal");
    expect(stored.selectedDuration).toBe(1800);
  });

  it("shows error when starting without goal", () => {
    const { result } = renderHook(() =>
      useTimer(makeOptions({ goalSlug: "" })),
    );

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("goal");
  });

  it("shows error when starting without credentials", () => {
    const { result } = renderHook(() =>
      useTimer(makeOptions({ username: "" })),
    );

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Username");
  });

  it("cancels timer with confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useTimer(makeOptions()));

    act(() => {
      result.current.startTimer();
    });
    act(() => {
      result.current.cancelTimer();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.running).toBe(false);
    expect(localStorage.getItem(TIMER_STATE_KEY)).toBeNull();
  });

  it("does not cancel timer when confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useTimer(makeOptions()));

    act(() => {
      result.current.startTimer();
    });
    act(() => {
      result.current.cancelTimer();
    });

    expect(result.current.status).toBe("running");
  });

  it("toggles pause", () => {
    const { result } = renderHook(() => useTimer(makeOptions()));

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.paused).toBe(false);

    act(() => {
      result.current.togglePause();
    });

    expect(result.current.paused).toBe(true);
    // Still "running" status but paused
    expect(result.current.status).toBe("running");

    act(() => {
      result.current.togglePause();
    });

    expect(result.current.paused).toBe(false);
  });

  it("resets after finish", () => {
    const { result } = renderHook(() => useTimer(makeOptions()));

    act(() => {
      result.current.startTimer();
    });
    act(() => {
      result.current.resetAfterFinish();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.flushMessage).toBeNull();
    expect(localStorage.getItem(TIMER_STATE_KEY)).toBeNull();
  });

  it("loads persisted timer state on mount", () => {
    localStorage.setItem(
      TIMER_STATE_KEY,
      JSON.stringify({
        status: "running",
        remaining: 900,
        deadline: Date.now() + 900_000,
        paused: false,
        goalSlug: "test-goal",
        selectedDuration: 1800,
        comment: "",
      }),
    );

    const { result } = renderHook(() => useTimer(makeOptions()));

    expect(result.current.status).toBe("running");
    expect(result.current.running).toBe(true);
  });

  it("countdown decrements remaining based on deadline", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer(makeOptions({ selectedDuration: 10 })),
    );

    act(() => {
      result.current.startTimer();
    });

    // Advance time by 3 seconds
    vi.setSystemTime(now + 3000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.displayTime).toBe("00:07");
  });

  it("calls onComplete when timer reaches 0", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer(makeOptions({ selectedDuration: 1, onComplete })),
    );

    act(() => {
      result.current.startTimer();
    });

    // Advance past the deadline
    vi.setSystemTime(now + 2000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Let the async onComplete resolve
    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("flushTimer logs elapsed time", async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer(makeOptions({ selectedDuration: 600, onFlush })),
    );

    act(() => {
      result.current.startTimer();
    });

    // Advance by 120 seconds (2 minutes)
    vi.setSystemTime(now + 120_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      await result.current.flushTimer();
    });

    expect(onFlush).toHaveBeenCalledWith(120);
    expect(result.current.status).toBe("idle");
    expect(result.current.flushMessage).toContain("2.00");
  });

  it("flushTimer shows message when no time elapsed", async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const { result } = renderHook(() =>
      useTimer(makeOptions({ selectedDuration: 600 })),
    );

    act(() => {
      result.current.startTimer();
    });

    // No time passes
    await act(async () => {
      await result.current.flushTimer();
    });

    expect(result.current.flushMessage).toBe("No time elapsed to flush.");
  });

  it("auto-renew restarts timer after completion", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer(
        makeOptions({ selectedDuration: 1, onComplete, autoRenew: true }),
      ),
    );

    act(() => {
      result.current.startTimer();
    });

    // Advance past the deadline
    vi.setSystemTime(now + 2000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Let the async onComplete resolve
    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    // Should restart instead of finishing
    await vi.waitFor(() => {
      expect(result.current.status).toBe("running");
    });
    expect(result.current.remaining).toBe(1);

    // localStorage should have the new timer state
    const stored = JSON.parse(localStorage.getItem(TIMER_STATE_KEY)!);
    expect(stored.status).toBe("running");
    expect(stored.autoRenew).toBe(true);
  });

  it("auto-renew false still finishes normally", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer(
        makeOptions({ selectedDuration: 1, onComplete, autoRenew: false }),
      ),
    );

    act(() => {
      result.current.startTimer();
    });

    // Advance past the deadline
    vi.setSystemTime(now + 2000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(result.current.status).toBe("finished");
    });
    expect(localStorage.getItem(TIMER_STATE_KEY)).toBeNull();
  });

  it("pomodoro mode inserts a break after work session", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer(
        makeOptions({
          selectedDuration: 1,
          onComplete,
          autoRenew: true,
          pomodoro: true,
        }),
      ),
    );

    act(() => {
      result.current.startTimer();
    });

    // Advance past the deadline
    vi.setSystemTime(now + 2000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // onComplete should be called (work session logged)
    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    // Should start a break session
    await vi.waitFor(() => {
      expect(result.current.status).toBe("running");
    });
    expect(result.current.isBreak).toBe(true);
    expect(result.current.remaining).toBe(POMODORO_BREAK);
  });

  it("break session ends and starts new work session without posting", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    vi.setSystemTime(now);

    // Start with a persisted break state
    localStorage.setItem(
      TIMER_STATE_KEY,
      JSON.stringify({
        status: "running",
        remaining: 1,
        deadline: now + 1000,
        paused: false,
        goalSlug: "test-goal",
        selectedDuration: 1800,
        comment: "",
        autoRenew: true,
        pomodoro: true,
        isBreak: true,
      }),
    );

    const { result } = renderHook(() =>
      useTimer(
        makeOptions({
          selectedDuration: 1800,
          onComplete,
          autoRenew: true,
          pomodoro: true,
        }),
      ),
    );

    expect(result.current.isBreak).toBe(true);
    expect(result.current.status).toBe("running");

    // Advance past the break deadline
    vi.setSystemTime(now + 2000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Should start a new work session WITHOUT calling onComplete
    await vi.waitFor(() => {
      expect(result.current.remaining).toBe(1800);
    });
    expect(result.current.isBreak).toBe(false);
    expect(result.current.status).toBe("running");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("pomodoro without autoRenew finishes normally", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer(
        makeOptions({
          selectedDuration: 1,
          onComplete,
          autoRenew: false,
          pomodoro: true,
        }),
      ),
    );

    act(() => {
      result.current.startTimer();
    });

    // Advance past the deadline
    vi.setSystemTime(now + 2000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    // Should finish normally (no break), since autoRenew is off
    await vi.waitFor(() => {
      expect(result.current.status).toBe("finished");
    });
    expect(result.current.isBreak).toBe(false);
  });

  it("updates document title when running", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTimer(makeOptions({ selectedDuration: 90 })),
    );

    act(() => {
      result.current.startTimer();
    });

    expect(document.title).toBe("01:30 · Beeminder Timer");

    // Advance 30 seconds
    vi.setSystemTime(now + 30_000);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(document.title).toBe("01:00 · Beeminder Timer");
  });
});
