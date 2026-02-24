import { useState, useCallback } from "react";
import { VOLUME_KEY } from "../constants.ts";

function loadVolume(): number {
  const stored = localStorage.getItem(VOLUME_KEY);
  if (stored !== null) {
    const parsed = parseFloat(stored);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  }
  return 0.7;
}

export function useVolume() {
  const [volume, setVolumeState] = useState<number>(loadVolume);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    localStorage.setItem(VOLUME_KEY, String(clamped));
    setVolumeState(clamped);
  }, []);

  return { volume, setVolume };
}
