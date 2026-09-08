import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearOfflineCaches,
  isNetworkError,
  readOfflineCache,
  removeOfflineCache,
  writeOfflineCache,
} from "../use-offline-cache";

describe("useOfflineCache", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("round-trips a value with the time it was saved", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    writeOfflineCache("list", { id: "a", items: [1, 2] });

    const entry = readOfflineCache<{ id: string; items: number[] }>("list");
    expect(entry?.savedAt).toBe(1_700_000_000_000);
    expect(entry?.value).toEqual({ id: "a", items: [1, 2] });
  });

  test("returns null for a missing or malformed entry", () => {
    expect(readOfflineCache("nope")).toBeNull();

    localStorage.setItem("mealie-offline:broken", "{not json");
    expect(readOfflineCache("broken")).toBeNull();

    localStorage.setItem("mealie-offline:shape", JSON.stringify({ value: 1 }));
    expect(readOfflineCache("shape")).toBeNull();
  });

  test("removes a single entry and clears only its own keys", () => {
    localStorage.setItem("unrelated", "keep me");
    writeOfflineCache("a", 1);
    writeOfflineCache("b", 2);

    removeOfflineCache("a");
    expect(readOfflineCache("a")).toBeNull();
    expect(readOfflineCache("b")?.value).toBe(2);

    clearOfflineCaches();
    expect(readOfflineCache("b")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep me");
  });

  test("drops the entry instead of keeping a stale one when the write fails", () => {
    writeOfflineCache("a", "old");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    writeOfflineCache("a", "new");
    expect(readOfflineCache("a")).toBeNull();
  });

  test("classifies errors that never reached the server as network errors", () => {
    expect(isNetworkError(new Error("Network Error"))).toBe(true);
    expect(isNetworkError(Object.assign(new Error("Unauthorized"), { response: { status: 401 } }))).toBe(false);
    expect(isNetworkError(Object.assign(new Error("Boom"), { response: { status: 500 } }))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
