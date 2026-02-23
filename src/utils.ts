export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export const getYouTubeTitle = async (url: string): Promise<string | null> => {
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
