import { useReadOnlyActions, useStoreActions } from "./use-actions-factory";
import type { BoundT } from "./types";
import { readOfflineCache, writeOfflineCache } from "~/composables/use-offline-cache";
import type { BaseCRUDAPI, BaseCRUDAPIReadOnly } from "~/lib/api/base/base-clients";
import type { QueryValue } from "~/lib/api/base/route";

export interface StoreOptions {
  /**
   * Keep the last successful response on the device and fall back to it when the server can't be
   * reached. Only for small stores that a page needs while offline (labels, units).
   */
  offlineCache?: boolean;
}

async function refreshWithOfflineCopy<T>(
  storeKey: string,
  store: Ref<T[]>,
  options: StoreOptions,
  refresh: () => Promise<boolean>,
): Promise<boolean> {
  const ok = await refresh();
  if (!options.offlineCache) {
    return ok;
  }

  const cacheKey = `store:${storeKey}`;
  if (ok) {
    writeOfflineCache(cacheKey, store.value);
  }
  else if (!store.value.length) {
    const cached = readOfflineCache<T[]>(cacheKey);
    if (cached) {
      store.value = cached.value;
    }
  }
  return ok;
}

export const useData = function <T extends BoundT>(defaultObject: T) {
  const data = reactive({ ...defaultObject });
  function reset() {
    Object.assign(data, defaultObject);
  };

  return { data, reset };
};

export const useReadOnlyStore = function <T extends BoundT>(
  storeKey: string,
  store: Ref<T[]>,
  loading: Ref<boolean>,
  initialized: Ref<boolean>,
  api: BaseCRUDAPIReadOnly<T>,
  params = {} as Record<string, QueryValue>,
  options: StoreOptions = {},
) {
  const storeActions = useReadOnlyActions(`${storeKey}-store-readonly`, api, store, loading, initialized);
  const actions = {
    ...storeActions,
    async refresh() {
      return await refreshWithOfflineCopy(storeKey, store, options, () => storeActions.refresh(1, -1, params));
    },
    flushStore() {
      store.value = [];
      initialized.value = false;
    },
  };

  // initial hydration
  if (!loading.value && !initialized.value) {
    actions.refresh();
  }

  return { store, actions };
};

export const useStore = function <T extends BoundT>(
  storeKey: string,
  store: Ref<T[]>,
  loading: Ref<boolean>,
  initialized: Ref<boolean>,
  api: BaseCRUDAPI<unknown, T, unknown>,
  params = {} as Record<string, QueryValue>,
  options: StoreOptions = {},
) {
  const storeActions = useStoreActions(`${storeKey}-store`, api, store, loading, initialized);
  const actions = {
    ...storeActions,
    async refresh() {
      return await refreshWithOfflineCopy(storeKey, store, options, () => storeActions.refresh(1, -1, params));
    },
    flushStore() {
      store.value = [];
      initialized.value = false;
    },
  };

  // initial hydration
  if (!loading.value && !initialized.value) {
    actions.refresh();
  }

  return { store, actions };
};
