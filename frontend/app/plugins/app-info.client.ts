import axios from "axios";
import type { AppInfo } from "~/lib/api/types/admin";
import { readOfflineCache, writeOfflineCache } from "~/composables/use-offline-cache";

const CACHE_KEY = "app-info";

export default defineNuxtPlugin({
  async setup() {
    let appInfo: AppInfo;
    try {
      const { data } = await axios.get<AppInfo>("/api/app/about");
      appInfo = data;
      writeOfflineCache(CACHE_KEY, data);
    }
    catch (error) {
      // Without this fallback an unreachable server fails the plugin and the whole app shows an
      // error page, which defeats the service worker having cached the app for offline use.
      const cached = readOfflineCache<AppInfo>(CACHE_KEY);
      if (!cached) {
        throw error;
      }
      console.warn("Server unreachable; using the last known app info");
      appInfo = cached.value;
    }

    return {
      provide: {
        appInfo,
      },
    };
  },
});
