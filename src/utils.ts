export function extractBeeminderError(
  status: number,
  responseText: string,
): string {
  try {
    const json = JSON.parse(responseText);
    const message =
      json?.errors?.message ?? json?.error ?? json?.message ?? null;
    if (typeof message === "string") return message;
  } catch {
    // not JSON
  }
  return `Beeminder API error (HTTP ${status}).`;
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export async function postBeeminderDatapoint(
  username: string,
  authToken: string,
  goalSlug: string,
  value: number,
  comment: string,
  timestamp: number,
): Promise<void> {
  const endpoint = `https://www.beeminder.com/api/v1/users/${encodeURIComponent(
    username,
  )}/goals/${encodeURIComponent(goalSlug)}/datapoints.json`;

  const params = new URLSearchParams({
    auth_token: authToken,
    value: value.toString(),
    comment,
    timestamp: timestamp.toString(),
  });

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (e) {
    if (e instanceof TypeError) {
      throw new NetworkError(e.message);
    }
    throw e;
  }

  const text = await res.text();

  if (!res.ok) {
    throw new Error(extractBeeminderError(res.status, text));
  }
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export const getYouTubeTitle = async (url: string): Promise<string | null> => {
  const match = url.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/)watch\?v=(.*)(?:&.*)?/,
  );
  if (!match) return null;
  const videoId = match[1];
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    if (res.ok) {
      const data = await res.json();
      return data.title;
    }
  } catch (e) {
    console.error("Failed to fetch YouTube title:", e);
  }
  return null;
};
