<template>
  <v-autocomplete
    ref="autocompleteRef"
    v-model="itemVal"
    v-bind="$attrs"
    v-model:search="searchInput"
    item-title="name"
    return-object
    :items="filteredItems"
    :prepend-inner-icon="icon || (search ? $globals.icons.search : $globals.icons.tags)"
    :menu-icon="search ? '' : undefined"
    :rounded="search ? true : '4px'"
    :custom-filter="() => true"
    :variant="search ? 'solo-filled' : undefined"
    :hide-no-data="hideCreateActions"
    color="primary"
    auto-select-first
    clearable
    hide-details
    @keyup.enter="emitCreate"
  >
    <template
      v-if="create"
      #append-item
    >
      <div v-if="showCreate && !hideCreateActions" class="px-2">
        <!-- callers can offer more than one action for the typed text (e.g. create vs. add as a note) -->
        <slot
          name="create-actions"
          :search="searchInput"
          :create="emitCreate"
          :blur="blur"
        >
          <BaseButton
            block
            size="small"
            @click="emitCreate"
          />
        </slot>
      </div>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import type { MultiPurposeLabelSummary } from "~/lib/api/types/labels";
import type { IngredientFood, IngredientUnit } from "~/lib/api/types/recipe";
import { useSearch } from "~/composables/use-search";

// v-model for the selected item
const modelValue = defineModel<MultiPurposeLabelSummary | IngredientFood | IngredientUnit | null>({ default: () => null });

// support v-model:item-id binding
const itemId = defineModel<string | null | undefined>("item-id", { default: undefined });

// support v-model:search-text, so a parent can act on text that matches no item
// (e.g. render its own create buttons outside the dropdown)
const searchText = defineModel<string>("search-text", { default: "" });

const props = defineProps({
  items: {
    type: Array as () => Array<MultiPurposeLabelSummary | IngredientFood | IngredientUnit>,
    required: true,
  },
  icon: {
    type: String,
    required: false,
    default: undefined,
  },
  create: {
    type: Boolean,
    default: false,
  },
  search: {
    type: Boolean,
    default: false,
  },
  // keep Enter-to-create but leave the dropdown free of buttons; the parent renders them
  hideCreateActions: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  (e: "create", val: string): void;
}>();

const autocompleteRef = ref<HTMLInputElement>();

// Use the search composable
const { search: searchInput, filtered: filteredItems } = useSearch(computed(() => props.items));

watch(searchInput, val => searchText.value = val ?? "");
watch(searchText, (val) => {
  if (val !== searchInput.value) {
    searchInput.value = val;
  }
});

const itemVal = computed({
  get: () => {
    if (!modelValue.value || Object.keys(modelValue.value).length === 0) {
      return null;
    }
    return modelValue.value;
  },
  set: (val) => {
    itemId.value = val?.id ?? null;
    modelValue.value = val;
  },
});

// when the selection is cleared from outside (e.g. the form resets after saving), drop the typed text too
watch(modelValue, (val) => {
  if (!val) {
    searchInput.value = "";
  }
});

// nothing to create when the field is empty or the text already names an existing item
const showCreate = computed(() => {
  const search = searchInput.value?.trim().toLowerCase();
  return !!search && !props.items.some(item => item.name.toLowerCase() === search);
});

function blur() {
  autocompleteRef.value?.blur();
}

function emitCreate() {
  if (!showCreate.value) {
    return;
  }
  emit("create", searchInput.value.trim());
  blur();
}

defineExpose({
  focus: () => autocompleteRef.value?.focus(),
  blur,
});
</script>
