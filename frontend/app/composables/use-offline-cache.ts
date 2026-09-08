/**
 * A very small "last known good" cache on top of localStorage.
 *
 * It exists so the shopping list (and the handful of requests the app needs to boot) can be shown
 * when the server is unreachable: no signal in the shop, a NAS that is rebooting, and so on. Every
 * entry is stored with the time it was saved so the UI can say how old the copy is.
 *
 * Only data the signed-in user is allowed to see is ever written here, and everything is removed on
 * sign-out or when the server rejects the token.
 */

const PREFIX = "mealie-offline:";

/** Offline-cache key holding the id of the shopping list that was opened most recently. */
export const LAST_SHOPPING_LIST_KEY = "last-shopping-list";

/**
 * True when the app had to start from cached data because the server could not be reached
 * (the session or app-info request failed). The landing page uses it to go straight to the
 * shopping list, the one part of the app that is useful in that state.
 */
export const bootedOffline = ref(false);

export function markBootedOffline(): void {
  bootedOffline.value = true;
}

/** Where to send the user when the server can't be reached: the last opened list, or the list index. */
export function offlineLandingRoute(): string {
  const lastList = readOfflineCache<string>(LAST_SHOPPING_LIST_KEY)?.value;
  return lastList ? `/shopping-lists/${lastList}` : "/shopping-lists";
}

export interface OfflineCacheEntry<T> {
  savedAt: number;
  value: T;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  }
  catch {
    return null;
  }
}

export function writeOfflineCache<T>(key: string, value: T): void {
  const store = storage();
  if (!store) {
    return;
  }

  const entry: OfflineCacheEntry<T> = { savedAt: Date.now(), value };
  try {
    store.setItem(PREFIX + key, JSON.stringify(entry));
  }
  catch (error) {
    // quota exceeded or storage disabled; a stale copy is worse than none, so drop this key
    console.warn(`Could not save offline copy of "${key}":`, error);
    try {
      store.removeItem(PREFIX + key);
    }
    catch {
      // nothing else we can do
    }
  }
}

export function readOfflineCache<T>(key: string): OfflineCacheEntry<T> | null {
  const store = storage();
  if (!store) {
    return null;
  }

  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as OfflineCacheEntry<T>;
    if (typeof entry?.savedAt !== "number" || !("value" in entry)) {
      return null;
    }
    return entry;
  }
  catch {
    return null;
  }
}

export function removeOfflineCache(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  }
  catch {
    // ignore
  }
}

export function clearOfflineCaches(): void {
  const store = storage();
  if (!store) {
    return;
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => store.removeItem(key));
  }
  catch {
    // ignore
  }
}

/**
 * True when a request could not reach the Mealie server: no response at all (offline, DNS failure,
 * timeout) or a gateway error from a reverse proxy in front of a backend that is down (502/503/504).
 * Any other status means the server itself answered, so the error is not a connectivity problem.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeAxios = error as { response?: { status?: number } | null };
  if (maybeAxios.response === undefined || maybeAxios.response === null) {
    return true;
  }
  return [502, 503, 504].includes(maybeAxios.response.status ?? 0);
}
