import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatTime, getYouTubeTitle } from "./utils.ts";

describe("formatTime", () => {
  it("formats 0 seconds", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatTime(5)).toBe("00:05");
    expect(formatTime(59)).toBe("00:59");
  });

  it("formats exact minutes", () => {
    expect(formatTime(60)).toBe("01:00");
    expect(formatTime(300)).toBe("05:00");
    expect(formatTime(1800)).toBe("30:00");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(90)).toBe("01:30");
    expect(formatTime(125)).toBe("02:05");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("formats over 60 minutes", () => {
    expect(formatTime(3600)).toBe("60:00");
    expect(formatTime(3661)).toBe("61:01");
  });

  it("pads single-digit values with leading zeros", () => {
    expect(formatTime(1)).toBe("00:01");
    expect(formatTime(61)).toBe("01:01");
  });
});

describe("getYouTubeTitle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for non-YouTube URLs", async () => {
    expect(await getYouTubeTitle("https://example.com")).toBeNull();
    expect(await getYouTubeTitle("not a url")).toBeNull();
    expect(await getYouTubeTitle("")).toBeNull();
  });

  it("returns null for YouTube URLs without video ID pattern", async () => {
    expect(await getYouTubeTitle("https://youtube.com/")).toBeNull();
    expect(await getYouTubeTitle("https://youtube.com/channel/abc")).toBeNull();
  });

  it("fetches title for valid YouTube URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Test Video Title" }),
    } as Response);

    const title = await getYouTubeTitle(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(title).toBe("Test Video Title");
    expect(fetch).toHaveBeenCalledWith(
      "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=json",
    );
  });

  it("returns null when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const title = await getYouTubeTitle(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(title).toBeNull();
  });

  it("returns null when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
    } as Response);

    const title = await getYouTubeTitle(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(title).toBeNull();
  });

  it("handles YouTube URL without www", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ title: "No WWW Title" }),
    } as Response);

    const title = await getYouTubeTitle("https://youtube.com/watch?v=abc123");
    expect(title).toBe("No WWW Title");
  });

  it("handles YouTube URL with extra params", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Param Title" }),
    } as Response);

    const title = await getYouTubeTitle(
      "https://www.youtube.com/watch?v=abc123&t=30",
    );
    expect(title).toBe("Param Title");
  });
});
