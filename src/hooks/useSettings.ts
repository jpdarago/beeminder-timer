import { useState } from "react";
import type { StoredSettings } from "../types.ts";
import { SETTINGS_KEY } from "../constants.ts";

function loadStoredSettings(): StoredSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSettings;
      console.log("Loaded saved settings on startup:", {
        username: parsed.username ?? "",
        authToken: parsed.authToken ? "***" : "(none)",
      });
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function useSettings() {
  const [stored] = useState(loadStoredSettings);
  const hasCredentials = !!(stored?.username && stored?.authToken);
  const [username, setUsername] = useState(stored?.username ?? "");
  const [authToken, setAuthToken] = useState(stored?.authToken ?? "");
  const [hasStoredSettings, setHasStoredSettings] = useState(hasCredentials);
  const [showSettingsForm, setShowSettingsForm] = useState(!hasCredentials);

  const saveSettings = (goalSlug: string) => {
    const settings: StoredSettings = { username, authToken, goalSlug };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (username && authToken) {
      setHasStoredSettings(true);
      setShowSettingsForm(false);
    }
  };

  return {
    username,
    setUsername,
    authToken,
    setAuthToken,
    hasStoredSettings,
    showSettingsForm,
    setShowSettingsForm,
    saveSettings,
  };
}
