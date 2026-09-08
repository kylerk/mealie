<template>
  <v-alert
    density="compact"
    variant="tonal"
    color="grey"
    :icon="false"
    class="offline-banner mb-2"
    role="button"
    tabindex="0"
    :aria-expanded="String(expanded)"
    @click="expanded = !expanded"
    @keydown.enter.space.prevent="expanded = !expanded"
  >
    <div class="d-flex align-center">
      <span class="font-weight-medium flex-grow-1">{{ $t("shopping-list.offline-mode") }}</span>
      <v-icon size="small" class="ml-2 flex-shrink-0">
        {{ expanded ? $globals.icons.chevronUp : $globals.icons.chevronDown }}
      </v-icon>
    </div>
    <div v-if="expanded" class="text-body-2 mt-1">
      {{ description }}
    </div>
  </v-alert>
</template>

<script setup lang="ts">
defineProps({
  /** Shown below the title when the banner is expanded */
  description: {
    type: String,
    required: true,
  },
});

// one line tall until tapped; the explanation is the same every time, so it stays out of the way
const expanded = ref(false);
</script>

<style scoped>
.offline-banner {
  cursor: pointer;
  user-select: none;
}
</style>
