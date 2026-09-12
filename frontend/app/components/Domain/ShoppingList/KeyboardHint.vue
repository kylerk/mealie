<template>
  <span class="keyboard-hint text-no-wrap">
    <template v-for="(key, index) in keyList" :key="key">
      <span v-if="index > 0" class="keyboard-hint__plus">+</span>
      <kbd class="keyboard-hint__key">{{ key }}</kbd>
    </template>
    <span v-if="label" class="keyboard-hint__label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
// A keyboard shortcut rendered as key caps, e.g. keys="Shift+Enter" -> [Shift]+[Enter],
// optionally followed by what it does. Used to make the shortcuts on the shopping list
// discoverable without a manual.
const props = defineProps({
  keys: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: "",
  },
});

const keyList = computed(() => props.keys.split("+").map(key => key.trim()).filter(Boolean));
</script>

<style scoped lang="scss">
.keyboard-hint {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.75rem;
  line-height: 1;
}

.keyboard-hint__key {
  display: inline-block;
  padding: 2px 5px;
  border: 1px solid rgba(var(--v-border-color), 0.4);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: inherit;
  text-transform: none;
}

.keyboard-hint__plus {
  opacity: 0.6;
}

.keyboard-hint__label {
  margin-left: 4px;
  opacity: 0.8;
}
</style>
