import { useState } from "react";
import type { StoredSettings } from "../types.ts";
import { SETTINGS_KEY } from "../constants.ts";

function loadStoredSettings(): StoredSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSettings;
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
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const saveSettings = async (goalSlug: string) => {
    if (!username || !authToken) {
      setValidationError("Username and auth token are required.");
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      const endpoint = `https://www.beeminder.com/api/v1/users/${encodeURIComponent(
        username,
      )}.json?auth_token=${encodeURIComponent(authToken)}`;
      const res = await fetch(endpoint);

      if (!res.ok) {
        setValidationError(
          res.status === 401
            ? "Invalid username or auth token."
            : `Beeminder API error ${res.status}. Please check your credentials.`,
        );
        return;
      }

      const settings: StoredSettings = { username, authToken, goalSlug };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setHasStoredSettings(true);
      setShowSettingsForm(false);
    } catch {
      setValidationError(
        "Could not reach Beeminder. Settings saved locally without validation.",
      );
      // Still save on network error so the app works offline
      const settings: StoredSettings = { username, authToken, goalSlug };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setHasStoredSettings(true);
      setShowSettingsForm(false);
    } finally {
      setValidating(false);
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
    validating,
    validationError,
    saveSettings,
  };
}
