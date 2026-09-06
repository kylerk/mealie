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
      :text="primaryText || $t('shopping-list.create-and-add-to-list')"
      :disabled="disabled"
      :style="row ? 'flex: 1 1 auto' : undefined"
      @click="$emit('primary')"
    />
    <BaseButton
      :block="!row"
      size="small"
      secondary
      :icon="secondaryIcon || $globals.icons.textBox"
      :text="secondaryText || $t('shopping-list.add-as-note')"
      :disabled="disabled"
      :style="row ? 'flex: 1 1 auto' : undefined"
      @click="$emit('secondary')"
    />
  </div>
</template>

<script setup lang="ts">
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
});

defineEmits<{
  (e: "primary" | "secondary"): void;
}>();
</script>
