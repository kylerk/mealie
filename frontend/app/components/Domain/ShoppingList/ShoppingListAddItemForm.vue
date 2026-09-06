<template>
  <v-navigation-drawer
    ref="target"
    permanent
    rounded="t-xl"
    location="bottom"
    class="pa-4 pt-2 mb-0"
    width="300"
    rail-width="85"
    :rail="rail"
    elevation="4"
  >
    <div class="d-flex flex-column ga-3">
      <v-card-actions class="pa-0">
        <div class="position-relative" style="flex: 1;">
          <InputLabelType
            ref="foodInputRef"
            v-model="listItem.food"
            v-model:item-id="listItem.foodId!"
            v-model:search-text="foodSearch"
            :items="foods"
            :label="rail ? $t('shopping-list.add-item') : $t('shopping-list.food')"
            :icon="$globals.icons.foods"
            :style="rail ? 'margin-inline: 3px;' : undefined"
            :search="rail"
            :menu-props="{ location: menuDirection }"
            create
            hide-create-actions
            @create="createAndAdd"
          />
          <!-- Intercept clicks when collapsed so the drawer expands before the autocomplete opens -->
          <div
            v-if="rail"
            class="position-absolute"
            style="inset: 0; cursor: text;"
            @click="expandAndFocus"
          />
        </div>
        <BaseButtonGroup
          v-if="!rail"
          :buttons="[
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
          @save="$emit('save')"
          @cancel="rail = true; $emit('cancel')"
        />
      </v-card-actions>

      <!-- Rendered here rather than inside the dropdown: on a phone the on-screen keyboard
           and a long list of matches can push a dropdown's tail out of reach -->
      <ShoppingListCreateItemActions
        v-if="!rail && canCreateFood"
        row
        @create="confirmPendingFood(createAndAdd)"
        @note="confirmPendingFood(addAsNote)"
      />

      <ShoppingListItemDetails
        v-if="!rail"
        v-model="listItem"
        :labels="labels"
        :units="units"
        @save="$emit('save')"
      />
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { useShoppingListItemEditor } from "~/composables/shopping-list-page/use-shopping-list-item-editor";
import type { ShoppingListItemCreate, ShoppingListItemOut } from "~/lib/api/types/household";
import type { MultiPurposeLabelOut } from "~/lib/api/types/labels";
import type { IngredientFood, IngredientUnit } from "~/lib/api/types/recipe";
import ShoppingListItemDetails from "./ShoppingListItemDetails.vue";
import ShoppingListCreateItemActions from "./ShoppingListCreateItemActions.vue";
import { onClickOutside } from "@vueuse/core";

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
});

const emit = defineEmits<{
  (e: "save" | "cancel" | "delete"): void;
}>();

const { createAssignFood, assignNote } = useShoppingListItemEditor(listItem);

// Typing a new food and confirming it should put it on the list in one step, rather than
// leaving the user to re-select the freshly created food and press save afterwards.
async function createAndAdd(val: string) {
  await createAssignFood(val);
  if (!listItem.value.foodId) {
    // creating the food failed (e.g. offline); still get the text onto the list
    assignNote(val);
  }
  emit("save");
  foodSearch.value = "";
}

function addAsNote(val: string) {
  assignNote(val);
  emit("save");
  foodSearch.value = "";
}

// text in the food field that names no existing food
const foodSearch = ref("");
const canCreateFood = computed(() => {
  const search = foodSearch.value.trim().toLowerCase();
  return !!search && !props.foods.some(food => food.name.toLowerCase() === search);
});

function confirmPendingFood(action: (val: string) => void) {
  const val = foodSearch.value.trim();
  foodInputRef.value?.blur();
  action(val);
}

const { smAndDown } = useDisplay();
const menuDirection = computed(() => smAndDown.value ? "top" : "bottom");

const foodInputRef = ref<{ focus: () => void; blur: () => void } | null>(null);
const rail = ref(true);

async function expandAndFocus() {
  rail.value = false;
  await nextTick();
  setTimeout(() => {
    foodInputRef.value?.focus();
  }, 200);
}

const target = ref();
// Autocomplete menus are teleported outside the drawer, so selecting an item
// would otherwise register as an outside click and collapse the form
onClickOutside(target, () => rail.value = true, { ignore: [".v-overlay-container"] });

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
</script>
