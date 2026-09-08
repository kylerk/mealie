/**
 * Diagnostics for the offline shopping list. Enabled by opening the list with `?debug=offline`
 * (the flag then sticks in localStorage until "Hide" is pressed), so the panel is also there on the
 * next offline open. The event log is persisted too, so what happened during a failed open can be
 * read afterwards.
 */

const FLAG_KEY = "mealie-offline-debug";
const LOG_KEY = "mealie-offline-debug-log";
const MAX_ENTRIES = 120;

export interface OfflineDebugEntry {
  t: number;
  msg: string;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  }
  catch {
    return null;
  }
}

function loadEntries(): OfflineDebugEntry[] {
  try {
    const raw = storage()?.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }
  catch {
    return [];
  }
}

const entries = ref<OfflineDebugEntry[]>(loadEntries());
const enabled = ref<boolean>(storage()?.getItem(FLAG_KEY) === "1");

function persist() {
  try {
    storage()?.setItem(LOG_KEY, JSON.stringify(entries.value));
  }
  catch {
    // ignore
  }
}

/** Append a line to the offline diagnostics log. Cheap when the panel is disabled (memory only). */
export function offlineDebugLog(msg: string): void {
  entries.value.push({ t: Date.now(), msg });
  if (entries.value.length > MAX_ENTRIES) {
    entries.value.splice(0, entries.value.length - MAX_ENTRIES);
  }
  if (enabled.value) {
    persist();
  }
}

export function useOfflineDebug() {
  function enable() {
    enabled.value = true;
    try {
      storage()?.setItem(FLAG_KEY, "1");
    }
    catch {
      // ignore
    }
    persist();
  }

  function disable() {
    enabled.value = false;
    try {
      storage()?.removeItem(FLAG_KEY);
      storage()?.removeItem(LOG_KEY);
    }
    catch {
      // ignore
    }
  }

  function clear() {
    entries.value = [];
    persist();
  }

  return { enabled, entries, enable, disable, clear };
}
