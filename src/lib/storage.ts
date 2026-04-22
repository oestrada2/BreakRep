/**
 * Thin localStorage wrapper.
 * For production, swap the body of each function with IndexedDB calls.
 * All keys are namespaced under "puh_" to avoid collisions.
 */

const KEYS = {
  SETTINGS: 'puh_settings',
  LOGS: 'puh_logs',
} as const;

export function saveSettings(settings: object): void {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export function loadSettings(): object | null {
  const raw = localStorage.getItem(KEYS.SETTINGS);
  return raw ? JSON.parse(raw) : null;
}

export function saveLogs(logs: object): void {
  localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
}

export function loadLogs(): object | null {
  const raw = localStorage.getItem(KEYS.LOGS);
  return raw ? JSON.parse(raw) : null;
}

export function clearAll(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
