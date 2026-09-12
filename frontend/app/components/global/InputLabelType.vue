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
    @keydown.capture="onKeydown"
    @keyup.enter="onEnterKeyup"
    @input="onUserEdit"
    @click:clear="onUserEdit"
  >
    <!-- prepended rather than appended: a long list of matches would otherwise push the
         buttons to the bottom of the dropdown, where they are clipped until the list is scrolled -->
    <template
      v-if="create"
      #prepend-item
    >
      <div v-if="showCreate && !hideCreateActions" class="px-2 pb-1">
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
  // "create": Enter (or Ctrl+Enter) on text that names no existing item.
  // "alt-enter": Shift+Enter; the parent may want to do something else with the typed text
  // (e.g. add it as a note).
  (e: "create" | "alt-enter", val: string): void;
  // Enter pressed without creating anything: the typed text picked (or already held) an
  // existing item, or the field is empty. Parents can treat it as "confirm this field".
  (e: "enter"): void;
}>();

const autocompleteRef = ref<HTMLInputElement>();

// Use the search composable
const { search: searchInput, filtered: filteredItems } = useSearch(computed(() => props.items));

// Vuetify resets its search text whenever the field gains or loses focus. On a phone that
// happens the moment a button is tapped or the keyboard is dismissed, which would wipe the
// text the caller is about to act on. So an empty value is only accepted when the user
// produced it (typing, or the clear button); any other reset gets the typed text put back.
let userCleared = false;
function onUserEdit(e?: Event) {
  // iOS Safari fires an extra input event on blur (committing autocorrect), carrying the typed
  // text; only an event that actually leaves the field empty counts as the user clearing it
  const target = e?.target as HTMLInputElement | undefined;
  userCleared = target ? !target.value : true;
}

watch(searchInput, (val) => {
  const byUser = userCleared;
  userCleared = false;
  if (!val && !byUser && searchText.value && !itemVal.value) {
    searchInput.value = searchText.value;
    return;
  }
  searchText.value = val ?? "";
});
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

// when the selection is cleared from outside (e.g. the form resets after saving), drop the typed
// text too; searchText goes first so the guard above does not put the old text straight back
watch(modelValue, (val) => {
  if (!val) {
    searchText.value = "";
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

function menuState() {
  return autocompleteRef.value as unknown as { menu?: boolean } | undefined;
}

function closeMenu() {
  const autocomplete = menuState();
  if (autocomplete) {
    autocomplete.menu = false;
  }
}

function emitCreate() {
  if (!showCreate.value) {
    return;
  }
  emit("create", searchInput.value.trim());
  blur();
}

// Plain Enter is left to Vuetify first (keydown picks the highlighted match), then acted on
// here on keyup. A modified Enter is claimed on keydown, before Vuetify can turn it into a
// selection, and the keyup that follows it is ignored so nothing happens twice.
let modifiedEnter = false;

function onKeydown(e: KeyboardEvent) {
  // Escape with the dropdown open only closes the dropdown. The event still bubbles (Vuetify's
  // own handler lives on an ancestor), so it is marked handled for ancestors that would
  // otherwise treat it as "close the whole form".
  if (e.key === "Escape") {
    if (menuState()?.menu) {
      closeMenu();
      e.preventDefault();
    }
    return;
  }
  if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey || e.shiftKey)) {
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  modifiedEnter = true;
  const val = searchInput.value?.trim() ?? "";
  if (e.shiftKey) {
    if (val) {
      closeMenu();
      emit("alt-enter", val);
    }
    return;
  }
  // Ctrl/Cmd+Enter: create the text as typed, even when a similar item is highlighted
  if (showCreate.value) {
    emitCreate();
  }
  else {
    closeMenu();
    emit("enter");
  }
}

function onEnterKeyup() {
  if (modifiedEnter) {
    modifiedEnter = false;
    return;
  }
  if (showCreate.value) {
    emitCreate();
    return;
  }
  // Vuetify opens the menu on Enter even when there is nothing left to pick; keep it shut
  // so the field is ready for whatever the parent does next (typically saving and clearing)
  closeMenu();
  emit("enter");
}

function clearSearch() {
  searchText.value = "";
  searchInput.value = "";
}

defineExpose({
  focus: () => autocompleteRef.value?.focus(),
  blur,
  // drop typed text that never became a selection (e.g. after the parent used it as a note)
  clearSearch,
});
</script>
