<template>
  <v-alert
    border="start"
    variant="tonal"
    type="warning"
    elevation="2"
    :icon="$globals.icons.alert"
    :class="{ 'banner-warning--collapsible': collapsible }"
    :role="collapsible ? 'button' : undefined"
    :tabindex="collapsible ? 0 : undefined"
    :aria-expanded="collapsible ? String(!collapsed) : undefined"
    @click="toggle"
    @keydown.enter.space.prevent="toggle"
  >
    <div class="d-flex align-center">
      <b v-if="title" class="flex-grow-1">{{ title }}</b>
      <v-icon
        v-if="collapsible"
        size="small"
        class="ml-2 flex-shrink-0"
      >
        {{ collapsed ? $globals.icons.chevronDown : $globals.icons.chevronUp }}
      </v-icon>
    </div>
    <template v-if="!collapsed">
      <div v-if="description">
        {{ description }}
      </div>
      <div
        v-if="$slots.default"
        class="py-2"
      >
        <slot />
      </div>
    </template>
  </v-alert>
</template>

<script setup lang="ts">
const props = defineProps({
  title: {
    type: String,
    required: false,
    default: "",
  },
  description: {
    type: String,
    required: false,
    default: "",
  },
  /** Tapping the banner hides or shows everything below the title */
  collapsible: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const collapsed = ref(false);

function toggle() {
  if (props.collapsible) {
    collapsed.value = !collapsed.value;
  }
}
</script>

<style scoped>
.banner-warning--collapsible {
  cursor: pointer;
  user-select: none;
}
</style>
