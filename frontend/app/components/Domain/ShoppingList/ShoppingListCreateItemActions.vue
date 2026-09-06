<template>
  <div
    class="d-flex ga-1"
    :class="row ? 'flex-row flex-wrap' : 'flex-column pb-1'"
  >
    <BaseButton
      :block="!row"
      size="small"
      color="success"
      :icon="$globals.icons.createAlt"
      :text="$t('shopping-list.create-and-add-to-list')"
      :style="row ? 'flex: 1 1 auto' : undefined"
      @click="$emit('create')"
    />
    <BaseButton
      :block="!row"
      size="small"
      secondary
      :icon="$globals.icons.textBox"
      :text="$t('shopping-list.add-as-note')"
      :style="row ? 'flex: 1 1 auto' : undefined"
      @click="$emit('note')"
    />
  </div>
</template>

<script setup lang="ts">
// The two ways free text in the food picker can land on the list:
// as a newly created food, or as a plain note that needs no food entry.
defineProps({
  // lay the buttons out side by side (for placing them under the field) instead of stacked (in a dropdown)
  row: {
    type: Boolean,
    default: false,
  },
});

defineEmits<{
  (e: "create" | "note"): void;
}>();
</script>
