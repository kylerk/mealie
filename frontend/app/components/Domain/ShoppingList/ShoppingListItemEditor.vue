<template>
  <v-card
    variant="elevated"
    class="pa-2"
    border="primary s-lg opacity-100"
    @keydown.esc="onEscape"
  >
    <div class="d-flex flex-column ga-3">
      <div>
        <InputLabelType
          ref="foodInputRef"
          v-model="listItem.food"
          v-model:item-id="listItem.foodId!"
          :items="foods"
          :label="$t('shopping-list.food')"
          :icon="$globals.icons.foods"
          :autofocus="autoFocus === 'food'"
          create
          @create="isNew ? createAndAdd($event) : createAssignFood($event)"
          @enter="save"
          @alt-enter="isNew ? addAsNote($event) : undefined"
        >
          <template v-if="isNew" #create-actions="{ search, create, blur }">
            <ShoppingListCreateItemActions
              :primary-keys="showKeyboardHints ? 'Ctrl+Enter' : ''"
              :secondary-keys="showKeyboardHints ? 'Shift+Enter' : ''"
              @primary="create()"
              @secondary="addAsNote(search); blur()"
            />
          </template>
        </InputLabelType>
        <!-- Desktop entry is keyboard-driven; spell the shortcuts out so nobody has to find them by trial -->
        <div
          v-if="showKeyboardHints"
          class="d-flex flex-wrap ga-3 mt-1 px-1 text-caption text-medium-emphasis"
        >
          <KeyboardHint keys="Enter" :label="$t('shopping-list.add-to-list')" />
          <KeyboardHint keys="Ctrl+Enter" :label="$t('shopping-list.create-as-new-food')" />
          <KeyboardHint keys="Shift+Enter" :label="$t('shopping-list.add-as-note')" />
          <KeyboardHint keys="Tab" :label="$t('shopping-list.set-quantity-and-label')" />
          <KeyboardHint keys="Esc" :label="$t('general.close')" />
        </div>
      </div>
      <ShoppingListItemDetails
        v-model="listItem"
        :labels="labels"
        :units="units"
        @save="save"
      />
    </div>
    <v-card-actions class="justify-end pa-0">
      <BaseButtonGroup
        :buttons="[
          ...(allowDelete
            ? [
              {
                icon: $globals.icons.delete,
                text: $t('general.delete'),
                event: 'delete',
              },
            ]
            : []),
          {
            icon: $globals.icons.close,
            text: $t('general.cancel'),
            event: 'cancel',
          },
          {
            icon: $globals.icons.save,
            text: $t('general.save'),
            event: 'save',
          },
        ]"
        @save="save"
        @cancel="$emit('cancel')"
        @delete="$emit('delete')"
      />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useShoppingListItemEditor } from "~/composables/shopping-list-page/use-shopping-list-item-editor";
import type { ShoppingListItemCreate, ShoppingListItemOut } from "~/lib/api/types/household";
import type { MultiPurposeLabelOut } from "~/lib/api/types/labels";
import type { IngredientFood, IngredientUnit } from "~/lib/api/types/recipe";
import ShoppingListItemDetails from "./ShoppingListItemDetails.vue";
import ShoppingListCreateItemActions from "./ShoppingListCreateItemActions.vue";
import KeyboardHint from "./KeyboardHint.vue";

// modelValue as reactive v-model
const listItem = defineModel<ShoppingListItemCreate | ShoppingListItemOut>({ required: true });

const props = defineProps({
  labels: {
    type: Array as () => MultiPurposeLabelOut[],
    required: true,
  },
  units: {
    type: Array as () => IngredientUnit[],
    required: true,
  },
  foods: {
    type: Array as () => IngredientFood[],
    required: true,
  },
  allowDelete: {
    type: Boolean,
    required: false,
    default: true,
  },
  // when editing a brand-new item, confirming a new food saves the item in one step
  isNew: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const emit = defineEmits<{
  (e: "save" | "cancel" | "delete"): void;
}>();

const { createAssignFood, assignNote } = useShoppingListItemEditor(listItem);

const { mdAndUp } = useDisplay();
// only where a physical keyboard is the norm, and only for quick entry of new items
const showKeyboardHints = computed(() => props.isNew && mdAndUp.value);

const foodInputRef = ref<{ focus: () => void; clearSearch: () => void } | null>(null);

// Saving a new item leaves the editor open (the parent just resets the item), so put the
// cursor back in the food field: the next item can be typed straight away.
function save() {
  if (props.isNew && !listItem.value.foodId && !listItem.value.note) {
    // nothing typed yet; the parent would ignore an empty item anyway
    return;
  }
  emit("save");
  if (props.isNew) {
    nextTick(() => {
      foodInputRef.value?.clearSearch();
      foodInputRef.value?.focus();
    });
  }
}

async function createAndAdd(val: string) {
  await createAssignFood(val);
  if (!listItem.value.foodId) {
    // creating the food failed (e.g. offline); still get the text onto the list
    assignNote(val);
  }
  save();
}

function addAsNote(val: string) {
  assignNote(val);
  save();
}

// Esc closes the editor, unless a field already used it to close its own dropdown
function onEscape(e: KeyboardEvent) {
  if (!e.defaultPrevented) {
    emit("cancel");
  }
}

watch(
  () => listItem.value.quantity,
  (newQty) => {
    if (!newQty) {
      listItem.value.quantity = 0;
    }
  },
);

watch(
  () => listItem.value.food,
  (newFood) => {
    listItem.value.label = newFood?.label || null;
    listItem.value.labelId = listItem.value.label?.id || null;
  },
);

const autoFocus = computed(() => (!listItem.value.food && listItem.value.note ? "note" : "food"));
</script>
