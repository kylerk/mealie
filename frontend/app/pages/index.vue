<template>
  <div />
</template>

<script setup lang="ts">
import useDefaultActivity from "~/composables/use-default-activity";
import { useUserActivityPreferences } from "~/composables/use-users/preferences";
import { useAsyncKey } from "~/composables/use-utils";
import { bootedOffline, offlineLandingRoute } from "~/composables/use-offline-cache";
import { offlineDebugLog } from "~/composables/use-offline-debug";
import type { AppInfo, AppStartupInfo } from "~/lib/api/types/admin";

definePageMeta({
  layout: "blank",
});

const auth = useMealieAuth();
const { $axios } = useNuxtApp();
const router = useRouter();
const activityPreferences = useUserActivityPreferences();
const { getDefaultActivityRoute } = useDefaultActivity();
const groupSlug = computed(() => auth.user.value?.groupSlug);

async function redirectPublicUserToDefaultGroup() {
  const { data } = await $axios.get<AppInfo>("/api/app/about");
  if (data?.defaultGroupSlug) {
    router.push(`/g/${data.defaultGroupSlug}`);
  }
  else {
    router.push("/login");
  }
}

// With no connection the shopping list is the one page that works (it keeps a copy on the device),
// so a fresh open goes straight there instead of to a recipe page that can't load.
function redirectOffline(reason: string) {
  const target = offlineLandingRoute();
  offlineDebugLog(`landing: ${reason}; going to ${target}`);
  router.replace(target);
}

useAsyncData(useAsyncKey(), async () => {
  if (groupSlug.value) {
    if (bootedOffline.value || !navigator.onLine) {
      redirectOffline(bootedOffline.value ? "app started from cached data" : "browser is offline");
      return;
    }

    let data;
    try {
      data = await $axios.get<AppStartupInfo>("/api/app/about/startup-info", { timeout: 5000 });
    }
    catch (error: any) {
      redirectOffline(`startup info failed (${error?.message ?? error})`);
      return;
    }
    const isDemo = data.data.isDemo;
    const isFirstLogin = data.data.isFirstLogin;
    const defaultActivityRoute = getDefaultActivityRoute(
      activityPreferences.value.defaultActivity,
      groupSlug.value,
    );
    if (!isDemo && isFirstLogin && auth.user.value?.admin) {
      router.push("/admin/setup");
    }
    else if (defaultActivityRoute) {
      router.push(defaultActivityRoute);
    }
    else {
      router.push(`/g/${groupSlug.value}`);
    }
  }
  else {
    redirectPublicUserToDefaultGroup();
  }
});
</script>
