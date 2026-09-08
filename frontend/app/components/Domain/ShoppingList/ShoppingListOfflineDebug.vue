<template>
  <v-card
    class="mt-6 offline-debug"
    variant="outlined"
  >
    <v-card-title class="d-flex align-center py-2">
      <span class="text-subtitle-1">Offline diagnostics</span>
      <v-spacer />
      <v-btn
        size="small"
        variant="text"
        @click="copyReport"
      >
        Copy
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        @click="refreshNow"
      >
        Refresh
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        @click="clear"
      >
        Clear log
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        @click="disable"
      >
        Hide
      </v-btn>
    </v-card-title>
    <v-card-text class="pt-0">
      <pre class="offline-debug__pre">{{ stateText }}</pre>
      <div class="text-caption mt-2 mb-1">
        Event log (newest last)
      </div>
      <pre class="offline-debug__pre">{{ logText }}</pre>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useOfflineDebug } from "~/composables/use-offline-debug";

interface Props {
  listId: string;
  isOffline: boolean;
  offlineCopySavedAt: number | null;
  lastSyncedAt: number | null;
  loadingCounter: number;
  itemCount: number;
  queueSummary: { create: number; update: number; delete: number; lastUpdate: number };
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "refresh"): void }>();

const { entries, clear, disable } = useOfflineDebug();
const nuxtApp = useNuxtApp();

interface Snapshot {
  [key: string]: unknown;
}

const snapshot = ref<Snapshot>({});

function fmt(ts: number | null | undefined) {
  return ts ? new Date(ts).toLocaleTimeString() : "never";
}

async function collect() {
  const out: Snapshot = {
    time: new Date().toLocaleTimeString(),
    build: (nuxtApp.$config as any)?.app?.buildId ?? "?",
    url: location.href,
    displayMode: window.matchMedia?.("(display-mode: standalone)").matches ? "standalone (home screen)" : "browser tab",
    navigatorOnLine: navigator.onLine,
    pageIsOffline: props.isOffline,
    offlineCopySavedAt: fmt(props.offlineCopySavedAt),
    lastSyncedAt: fmt(props.lastSyncedAt),
    loadingCounter: props.loadingCounter,
    itemsOnScreen: props.itemCount,
    queue: `${props.queueSummary.create} create / ${props.queueSummary.update} update / ${props.queueSummary.delete} delete, last ${fmt(props.queueSummary.lastUpdate)}`,
  };

  const pwa = (nuxtApp as any).$pwa;
  out.pwa = pwa
    ? {
        swActivated: pwa.swActivated,
        offlineReady: pwa.offlineReady,
        needRefresh: pwa.needRefresh,
        registrationError: pwa.registrationError,
        isPWAInstalled: pwa.isPWAInstalled,
      }
    : "$pwa not available";

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      out.serviceWorker = {
        controller: navigator.serviceWorker.controller?.state ?? "none (page not controlled)",
        registration: reg
          ? {
              scope: reg.scope,
              active: reg.active?.state ?? null,
              installing: reg.installing?.state ?? null,
              waiting: reg.waiting?.state ?? null,
            }
          : "none",
      };
    }
    else {
      out.serviceWorker = "unsupported";
    }
  }
  catch (error: any) {
    out.serviceWorker = `error: ${error?.message ?? error}`;
  }

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      const cacheInfo: Record<string, string> = {};
      for (const name of names) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        const hasRoot = keys.some(r => new URL(r.url).pathname === "/");
        cacheInfo[name] = `${keys.length} entries${hasRoot ? ", includes /" : ""}`;
      }
      out.caches = names.length ? cacheInfo : "none";
    }
    else {
      out.caches = "unsupported";
    }
  }
  catch (error: any) {
    out.caches = `error: ${error?.message ?? error}`;
  }

  try {
    const offlineKeys: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("mealie-offline:")) {
        continue;
      }
      const raw = localStorage.getItem(key) ?? "";
      let savedAt = "";
      try {
        savedAt = fmt(JSON.parse(raw)?.savedAt);
      }
      catch {
        savedAt = "unparseable";
      }
      offlineKeys[key.replace("mealie-offline:", "")] = `${(raw.length / 1024).toFixed(1)} KB, saved ${savedAt}`;
    }
    out.deviceCopies = Object.keys(offlineKeys).length ? offlineKeys : "none";
    out.thisListCached = Boolean(localStorage.getItem(`mealie-offline:shopping-list:${props.listId}`));
  }
  catch (error: any) {
    out.deviceCopies = `error: ${error?.message ?? error}`;
  }

  snapshot.value = out;
}

const stateText = computed(() => JSON.stringify(snapshot.value, null, 2));
const logText = computed(() =>
  entries.value.map(e => `${new Date(e.t).toLocaleTimeString()}  ${e.msg}`).join("\n") || "(empty)",
);

function refreshNow() {
  emit("refresh");
  collect();
}

async function copyReport() {
  const text = `${stateText.value}\n\n${logText.value}`;
  try {
    await navigator.clipboard.writeText(text);
  }
  catch {
    // clipboard may be unavailable; the text is on screen anyway
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  collect();
  timer = setInterval(collect, 3000);
});
onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<style scoped>
.offline-debug__pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 40vh;
  overflow: auto;
  margin: 0;
}
</style>
