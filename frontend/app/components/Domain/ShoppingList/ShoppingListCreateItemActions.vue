<template>
  <div
    class="d-flex ga-1"
    :class="row ? 'flex-row flex-wrap' : 'flex-column pb-1'"
  >
    <BaseButton
      :block="!row"
      size="small"
      color="success"
      :icon="primaryIcon || $globals.icons.createAlt"
      :disabled="disabled"
      :style="row ? 'flex: 1 1 auto' : undefined"
      @click="$emit('primary')"
    >
      {{ primaryText || $t('shopping-list.create-and-add-to-list') }}
      <KeyboardHint v-if="primaryKeys" :keys="primaryKeys" class="ms-2" />
    </BaseButton>
    <BaseButton
      :block="!row"
      size="small"
      secondary
      :icon="secondaryIcon || $globals.icons.textBox"
      :disabled="disabled"
      :style="row ? 'flex: 1 1 auto' : undefined"
      @click="$emit('secondary')"
    >
      {{ secondaryText || $t('shopping-list.add-as-note') }}
      <KeyboardHint v-if="secondaryKeys" :keys="secondaryKeys" class="ms-2" />
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
import KeyboardHint from "./KeyboardHint.vue";

// A stable pair of actions for the text in the food picker. By default they are the two
// ways free text can land on the list (create a food, or add a note); callers can relabel
// them for other states so the pair stays put instead of appearing and disappearing.
defineProps({
  // lay the buttons out side by side (for placing them under the field) instead of stacked (in a dropdown)
  row: {
    type: Boolean,
    default: false,
  },
  primaryText: {
    type: String,
    default: "",
  },
  primaryIcon: {
    type: String,
    default: "",
  },
  secondaryText: {
    type: String,
    default: "",
  },
  secondaryIcon: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  // keyboard shortcuts to show on the buttons (e.g. "Ctrl+Enter"); omitted on touch layouts
  primaryKeys: {
    type: String,
    default: "",
  },
  secondaryKeys: {
    type: String,
    default: "",
  },
});

defineEmits<{
  (e: "primary" | "secondary"): void;
}>();
</script>
