import { useEventListener, useLocalStorage, useOnline, useThrottleFn } from "@vueuse/core";
import { useUserApi } from "~/composables/api";
import { readOfflineCache, writeOfflineCache } from "~/composables/use-offline-cache";
import { offlineDebugLog } from "~/composables/use-offline-debug";
import type { ShoppingListItemOut, ShoppingListOut } from "~/lib/api/types/household";
import type { RequestResponse } from "~/lib/api/types/non-generated";

const localStorageKey = "shopping-list-queue";
const offlineCacheKeyPrefix = "shopping-list:";

// Without a timeout a request to a phone with "bars but no data" hangs for the OS's TCP timeout
// (often a minute or more) before the page can fall back to the device copy. The first fetch
// after opening the list gives up quickly so offline mode appears within seconds; later fetches
// get a little longer, and background retries while offline stay short so they never pile up.
const FIRST_FETCH_TIMEOUT_MS = 3000;
const FETCH_TIMEOUT_MS = 8000;
const OFFLINE_RETRY_TIMEOUT_MS = 6000;
const queueTimeout = 5 * 60 * 1000; // 5 minutes

type ItemQueueType = "create" | "update" | "delete";

export interface ShoppingListQueue {
  create: ShoppingListItemOut[];
  update: ShoppingListItemOut[];
  delete: ShoppingListItemOut[];

  lastUpdate: number;
}

interface Storage {
  [key: string]: ShoppingListQueue;
}

export function useShoppingListItemActions(shoppingListId: string) {
  const isOnline = useOnline();
  const api = useUserApi();
  const offlineCacheKey = offlineCacheKeyPrefix + shoppingListId;

  /**
   * When the server can't be reached, `getList` falls back to the copy saved on this device and
   * records when that copy was saved; null while the list is coming from the server.
   */
  const offlineCopySavedAt = ref<number | null>(null);

  /**
   * When the list currently held in memory was last confirmed by the server: the time of the last
   * successful fetch, or the save time of the device copy if that is what we're showing. Lets the
   * page say "copy from 10:32" the moment the connection drops, without waiting for a fetch to fail.
   */
  const lastSyncedAt = ref<number | null>(readOfflineCache<ShoppingListOut>(offlineCacheKey)?.savedAt ?? null);

  let hasAttemptedFetch = false;
  function requestTimeout(): number {
    if (!hasAttemptedFetch) {
      return FIRST_FETCH_TIMEOUT_MS;
    }
    return offlineCopySavedAt.value !== null ? OFFLINE_RETRY_TIMEOUT_MS : FETCH_TIMEOUT_MS;
  }
  const storage = useLocalStorage(localStorageKey, {} as Storage, { deep: true });
  const queue = reactive(getQueue());
  const queueEmpty = computed(() => !queue.create.length && !queue.update.length && !queue.delete.length);
  const queueSummary = computed(() => ({
    create: queue.create.length,
    update: queue.update.length,
    delete: queue.delete.length,
    lastUpdate: queue.lastUpdate,
  }));
  if (queueEmpty.value) {
    queue.lastUpdate = Date.now();
  }

  // Persisting the queue serialises every list's queue to localStorage on the main thread. Ticking
  // through a long list fires this on every tap, so the write is throttled (trailing edge), and
  // flushed immediately when the page is hidden or unloaded so an offline edit is never lost.
  function persistQueue() {
    storage.value[shoppingListId] = { ...queue };
  }
  const persistQueueThrottled = useThrottleFn(persistQueue, 500, true, false);

  persistQueue();
  watch(
    () => queue,
    () => {
      persistQueueThrottled();
    },
    {
      deep: true,
    },
  );

  if (import.meta.client) {
    useEventListener(window, "pagehide", persistQueue);
    useEventListener(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        persistQueue();
      }
    });
  }

  function isValidQueueObject(obj: any): obj is ShoppingListQueue {
    if (typeof obj !== "object" || obj === null) {
      return false;
    }

    const hasRequiredProps = "create" in obj && "update" in obj && "delete" in obj && "lastUpdate" in obj;
    if (!hasRequiredProps) {
      return false;
    }

    const arraysValid = Array.isArray(obj.create) && Array.isArray(obj.update) && Array.isArray(obj.delete);

    const lastUpdateValid = typeof obj.lastUpdate === "number" && !isNaN(new Date(obj.lastUpdate).getTime());

    return arraysValid && lastUpdateValid;
  }

  function createEmptyQueue(): ShoppingListQueue {
    const newQueue = { create: [], update: [], delete: [], lastUpdate: Date.now() };
    return newQueue;
  }

  function getQueue(): ShoppingListQueue {
    try {
      const fetchedQueue = storage.value[shoppingListId];
      if (!isValidQueueObject(fetchedQueue)) {
        console.log("Invalid queue object in local storage; resetting queue.");
        return createEmptyQueue();
      }
      else {
        return fetchedQueue;
      }
    }
    catch (error) {
      console.log("Error validating queue object in local storage; resetting queue.", error);
      return createEmptyQueue();
    }
  }

  function removeFromQueue(itemQueue: ShoppingListItemOut[], item: ShoppingListItemOut): boolean {
    const index = itemQueue.findIndex(i => i.id === item.id);
    if (index === -1) {
      return false;
    }

    itemQueue.splice(index, 1);
    return true;
  }

  function mergeListItemsByLatest(
    list1: ShoppingListItemOut[],
    list2: ShoppingListItemOut[],
  ) {
    const mergedList = [...list1];
    list2.forEach((list2Item) => {
      const conflictingItem = mergedList.find(item => item.id === list2Item.id);
      if (conflictingItem
        && list2Item.updatedAt && conflictingItem.updatedAt
        && list2Item.updatedAt > conflictingItem.updatedAt) {
        mergedList.splice(mergedList.indexOf(conflictingItem), 1, list2Item);
      }
      else if (!conflictingItem) {
        mergedList.push(list2Item);
      }
    });
    return mergedList;
  }

  async function getList() {
    const timeout = requestTimeout();
    hasAttemptedFetch = true;
    const response = await api.shopping.lists.getOne(shoppingListId, { timeout });
    let list = response.data;

    if (list) {
      // keep a copy for the next time the server is unreachable (saved before the queue is merged in,
      // so the copy is exactly what the server last told us)
      writeOfflineCache(offlineCacheKey, list);
      offlineCopySavedAt.value = null;
      lastSyncedAt.value = Date.now();
      offlineDebugLog(`getList: server returned ${list.listItems?.length ?? 0} items; device copy saved`);
    }
    else {
      const cached = readOfflineCache<ShoppingListOut>(offlineCacheKey);
      const reason = `${response.error?.message ?? (response.response ? `HTTP ${response.response.status}` : "no response")}, timeout ${timeout} ms`;
      if (!cached) {
        offlineCopySavedAt.value = null;
        offlineDebugLog(`getList: request failed (${reason}) and there is no device copy`);
        return null;
      }
      list = cached.value;
      offlineCopySavedAt.value = cached.savedAt;
      lastSyncedAt.value = cached.savedAt;
      offlineDebugLog(
        `getList: request failed (${reason}); using device copy from ${new Date(cached.savedAt).toLocaleTimeString()} with ${cached.value.listItems?.length ?? 0} items`,
      );
    }

    // Merge pending local changes (both online and offline)
    const createAndUpdateQueues = mergeListItemsByLatest(queue.update, queue.create);
    const deleteQueueIds = new Set(queue.delete.map(item => item.id));

    const filteredLocalChanges = createAndUpdateQueues.filter(item => !deleteQueueIds.has(item.id));
    let mergedItems = mergeListItemsByLatest(list.listItems ?? [], filteredLocalChanges);
    mergedItems = mergedItems.filter(item => !deleteQueueIds.has(item.id));

    list.listItems = mergedItems;
    return list;
  }

  function createItem(item: ShoppingListItemOut) {
    removeFromQueue(queue.create, item);
    removeFromQueue(queue.update, item);
    removeFromQueue(queue.delete, item);

    queue.create.push(item);
  }

  function updateItem(item: ShoppingListItemOut) {
    const removedFromCreate = removeFromQueue(queue.create, item);
    removeFromQueue(queue.update, item);
    removeFromQueue(queue.delete, item);

    if (removedFromCreate) {
      // This item hasn't been created yet, so keep it in create queue with updated data
      queue.create.push(item);
    }
    else {
      queue.update.push(item);
    }
  }

  function deleteItem(item: ShoppingListItemOut) {
    const removedFromCreate = removeFromQueue(queue.create, item);
    if (removedFromCreate) {
      // This item hasn't been created yet, so we don't need to delete it
      return;
    }

    removeFromQueue(queue.update, item);
    removeFromQueue(queue.delete, item);
    queue.delete.push(item);
  }

  function getQueueItems(itemQueueType: ItemQueueType) {
    return queue[itemQueueType];
  }

  function clearQueueItems(itemQueueType: ItemQueueType | "all", itemIds: string[] | null = null) {
    if (itemQueueType === "create" || itemQueueType === "all") {
      queue.create = itemIds ? queue.create.filter(item => !itemIds.includes(item.id)) : [];
    }
    if (itemQueueType === "update" || itemQueueType === "all") {
      queue.update = itemIds ? queue.update.filter(item => !itemIds.includes(item.id)) : [];
    }
    if (itemQueueType === "delete" || itemQueueType === "all") {
      queue.delete = itemIds ? queue.delete.filter(item => !itemIds.includes(item.id)) : [];
    }
    if (queueEmpty.value) {
      queue.lastUpdate = Date.now();
    }
  }

  function checkUpdateState(list: ShoppingListOut) {
    const cutoffDate = new Date(queue.lastUpdate + queueTimeout).toISOString();
    if (list.updatedAt && list.updatedAt > cutoffDate) {
      // If the queue is too far behind the shopping list to reliably do updates, we clear the queue
      console.log("Out of sync with server; clearing queue");
      clearQueueItems("all");
    }
  }

  /**
   * Processes the queue items and returns whether the processing was successful.
   */
  async function processQueueItems(
    action: (items: ShoppingListItemOut[]) => Promise<RequestResponse<any>>,
    itemQueueType: ItemQueueType,
  ): Promise<boolean> {
    let queueItems: ShoppingListItemOut[];
    try {
      queueItems = getQueueItems(itemQueueType);
      if (!queueItems.length) {
        return true;
      }
    }
    catch (error) {
      console.log(`Error fetching queue items of type ${itemQueueType}:`, error);
      clearQueueItems(itemQueueType);
      return false;
    }

    try {
      const itemsToProcess = [...queueItems];
      const itemIdsToProcess = itemsToProcess.map(item => item.id);

      await action(itemsToProcess)
        .then((response) => {
          // The browser can report "online" while nothing actually gets through (no signal in a
          // shop, a captive portal, the server being down). Only drop the queued changes when the
          // request really succeeded; otherwise they stay queued for the next attempt.
          if (isOnline.value && !response?.error) {
            clearQueueItems(itemQueueType, itemIdsToProcess);
            offlineDebugLog(`queue: sent ${itemIdsToProcess.length} ${itemQueueType}(s)`);
          }
          else {
            offlineDebugLog(
              `queue: kept ${itemIdsToProcess.length} ${itemQueueType}(s) (online=${isOnline.value}, error=${response?.error?.message ?? "none"})`,
            );
          }
        });
    }
    catch (error) {
      console.log(`Error processing queue items of type ${itemQueueType}:`, error);
      clearQueueItems(itemQueueType);
      return false;
    }

    return true;
  }

  async function process() {
    if (queueEmpty.value) {
      queue.lastUpdate = Date.now();
      return;
    }

    const data = await getList();
    if (!data) {
      return;
    }
    checkUpdateState(data);

    // We send each bulk request one at a time, since the backend may merge items
    // "failures" here refers to an actual error, rather than failing to reach the backend
    let failures = 0;
    const config = { timeout: requestTimeout() };
    if (!(await processQueueItems(items => api.shopping.items.deleteMany(items, config), "delete"))) failures++;
    if (!(await processQueueItems(items => api.shopping.items.updateMany(items, config), "update"))) failures++;
    if (!(await processQueueItems(items => api.shopping.items.createMany(items, config), "create"))) failures++;

    // If we're online, or the queue is empty, the queue is fully processed, so we're up to date
    // Otherwise, if all three queue processes failed, we've already reset the queue, so we need to reset the date
    if (isOnline.value || queueEmpty.value || failures === 3) {
      queue.lastUpdate = Date.now();
    }
  }

  return {
    getList,
    createItem,
    updateItem,
    deleteItem,
    process,
    offlineCopySavedAt,
    lastSyncedAt,
    queueSummary,

    __testing__: {
      queue,
      clearQueueItems,
      createEmptyQueue,
    },
  };
}
