import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOfflineQueue } from "./useOfflineQueue.ts";
import { OFFLINE_QUEUE_KEY } from "../constants.ts";
import type { QueuedDatapoint } from "../types.ts";

// Mock the utils module
vi.mock("../utils.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils.ts")>();
  return {
    ...actual,
    postBeeminderDatapoint: vi.fn(),
  };
});

import { postBeeminderDatapoint, NetworkError } from "../utils.ts";
const mockPost = postBeeminderDatapoint as ReturnType<typeof vi.fn>;

const item: QueuedDatapoint = {
  goalSlug: "focus",
  value: 30,
  comment: "test session",
  timestamp: 1700000000,
  queuedAt: 1700000000000,
};

describe("useOfflineQueue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockPost.mockReset();
  });

  it("starts with empty queue", () => {
    const { result } = renderHook(() => useOfflineQueue("user", "token"));
    expect(result.current.queue).toEqual([]);
  });

  it("loads queue from localStorage on mount", () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([item]));
    // mockPost succeeds — item will be processed on mount
    mockPost.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useOfflineQueue("user", "token"));
    // Initial state comes from lazy initializer before processQueue runs
    expect(result.current.queue).toEqual([item]);
  });

  it("enqueue adds item and persists to localStorage", () => {
    const { result } = renderHook(() => useOfflineQueue("user", "token"));

    act(() => {
      result.current.enqueue(item);
    });

    expect(result.current.queue).toEqual([item]);
    const stored = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)!);
    expect(stored).toEqual([item]);
  });

  it("enqueue appends to existing queue", () => {
    const { result } = renderHook(() => useOfflineQueue("user", "token"));

    const item2: QueuedDatapoint = { ...item, goalSlug: "reading", queuedAt: item.queuedAt + 1 };

    act(() => {
      result.current.enqueue(item);
    });
    act(() => {
      result.current.enqueue(item2);
    });

    expect(result.current.queue).toHaveLength(2);
    expect(result.current.queue[0].goalSlug).toBe("focus");
    expect(result.current.queue[1].goalSlug).toBe("reading");
  });

  it("processQueue posts and clears items on success", async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([item]));
    mockPost.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOfflineQueue("user", "token"));

    await act(async () => {
      await result.current.processQueue();
    });

    expect(result.current.queue).toEqual([]);
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
    expect(mockPost).toHaveBeenCalledWith(
      "user", "token", "focus", 30, "test session", 1700000000,
    );
  });

  it("processQueue stops on NetworkError and keeps remaining items", async () => {
    const item2: QueuedDatapoint = { ...item, goalSlug: "reading", queuedAt: item.queuedAt + 1 };
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([item, item2]));
    mockPost.mockRejectedValue(new NetworkError("Failed to fetch"));

    const { result } = renderHook(() => useOfflineQueue("user", "token"));

    await act(async () => {
      await result.current.processQueue();
    });

    // Both items should remain (stopped at first)
    expect(result.current.queue).toHaveLength(2);
  });

  it("processQueue drops items with API errors", async () => {
    const item2: QueuedDatapoint = { ...item, goalSlug: "reading", queuedAt: item.queuedAt + 1 };
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([item, item2]));
    // First item: API error (dropped), second item: success
    mockPost.mockRejectedValueOnce(new Error("Beeminder error 422: Invalid"));
    mockPost.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useOfflineQueue("user", "token"));

    await act(async () => {
      await result.current.processQueue();
    });

    expect(result.current.queue).toEqual([]);
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });

  it("processQueue does nothing without credentials", async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([item]));

    const { result } = renderHook(() => useOfflineQueue("", ""));

    await act(async () => {
      await result.current.processQueue();
    });

    // Queue should remain untouched
    expect(result.current.queue).toEqual([item]);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("listens for online event", async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([item]));
    // First call on mount: network error (still offline)
    mockPost.mockRejectedValueOnce(new NetworkError("Failed to fetch"));
    // Second call when going online: success
    mockPost.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useOfflineQueue("user", "token"));

    // Wait for mount processQueue
    await act(async () => {});

    expect(result.current.queue).toHaveLength(1);

    // Simulate going online
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.queue).toEqual([]);
  });

  it("cleans up online listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useOfflineQueue("user", "token"));

    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });
});
