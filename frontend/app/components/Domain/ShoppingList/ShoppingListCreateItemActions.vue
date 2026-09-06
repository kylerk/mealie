<template>
  <div class="d-flex flex-column ga-1 pb-1">
    <BaseButton
      block
      size="small"
      color="success"
      :icon="$globals.icons.createAlt"
      :text="$t('shopping-list.create-and-add-to-list')"
      @click="$emit('create')"
    />
    <BaseButton
      block
      size="small"
      secondary
      :icon="$globals.icons.textBox"
      :text="$t('shopping-list.add-as-note')"
      @click="$emit('note')"
    />
  </div>
</template>

<script setup lang="ts">
// The two ways free text in the food picker can land on the list:
// as a newly created food, or as a plain note that needs no food entry.
defineEmits<{
  (e: "create" | "note"): void;
}>();
</script>
