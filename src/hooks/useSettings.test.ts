import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettings } from "./useSettings.ts";
import { SETTINGS_KEY } from "../constants.ts";

describe("useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty state when no stored settings", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.username).toBe("");
    expect(result.current.authToken).toBe("");
    expect(result.current.hasStoredSettings).toBe(false);
    expect(result.current.showSettingsForm).toBe(true);
  });

  it("loads credentials from localStorage on mount", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        username: "alice",
        authToken: "tok123",
        goalSlug: "focus",
      }),
    );

    const { result } = renderHook(() => useSettings());
    expect(result.current.username).toBe("alice");
    expect(result.current.authToken).toBe("tok123");
    expect(result.current.hasStoredSettings).toBe(true);
    expect(result.current.showSettingsForm).toBe(false);
  });

  it("shows settings form when stored credentials are incomplete", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ username: "alice", authToken: "", goalSlug: "" }),
    );

    const { result } = renderHook(() => useSettings());
    expect(result.current.username).toBe("alice");
    expect(result.current.authToken).toBe("");
    expect(result.current.hasStoredSettings).toBe(false);
    expect(result.current.showSettingsForm).toBe(true);
  });

  it("handles malformed JSON in localStorage gracefully", () => {
    localStorage.setItem(SETTINGS_KEY, "not-json");

    const { result } = renderHook(() => useSettings());
    expect(result.current.username).toBe("");
    expect(result.current.authToken).toBe("");
    expect(result.current.hasStoredSettings).toBe(false);
    expect(result.current.showSettingsForm).toBe(true);
  });

  it("saveSettings persists to localStorage and hides form", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ username: "bob" }), { status: 200 }),
    );

    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setUsername("bob");
    });
    act(() => {
      result.current.setAuthToken("secret");
    });
    await act(async () => {
      await result.current.saveSettings("my-goal");
    });

    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(stored).toEqual({
      username: "bob",
      authToken: "secret",
      goalSlug: "my-goal",
    });
    expect(result.current.hasStoredSettings).toBe(true);
    expect(result.current.showSettingsForm).toBe(false);
  });

  it("saveSettings without credentials keeps form open", async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.saveSettings("my-goal");
    });

    // Does not persist to localStorage when credentials are empty
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    // Form stays open and hasStoredSettings remains false
    expect(result.current.hasStoredSettings).toBe(false);
    expect(result.current.showSettingsForm).toBe(true);
    expect(result.current.validationError).toBe(
      "Username and auth token are required.",
    );
  });

  it("setUsername updates username", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setUsername("charlie");
    });

    expect(result.current.username).toBe("charlie");
  });

  it("setAuthToken updates authToken", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setAuthToken("new-token");
    });

    expect(result.current.authToken).toBe("new-token");
  });

  it("setShowSettingsForm toggles visibility", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        username: "alice",
        authToken: "tok",
        goalSlug: "",
      }),
    );

    const { result } = renderHook(() => useSettings());
    expect(result.current.showSettingsForm).toBe(false);

    act(() => {
      result.current.setShowSettingsForm(true);
    });

    expect(result.current.showSettingsForm).toBe(true);
  });
});
