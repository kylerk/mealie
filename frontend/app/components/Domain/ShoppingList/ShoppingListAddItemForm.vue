<template>
  <v-navigation-drawer
    ref="target"
    permanent
    rounded="t-xl"
    location="bottom"
    class="pa-4 pt-2 mb-0 shopping-list-add-item-form"
    width="300"
    rail-width="85"
    :rail="rail"
    elevation="4"
  >
    <div class="d-flex flex-column ga-3">
      <v-card-actions class="pa-0">
        <div ref="fieldWrapper" class="position-relative" style="flex: 1;">
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
            :menu-props="menuProps"
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
        <!-- This row is the one spot that is visible whenever the field is, wherever the
             dropdown or the on-screen keyboard end up, so unmatched text can be confirmed here too -->
        <BaseButtonGroup
          v-if="!rail"
          :buttons="rowButtons"
          @save="canCreateFood ? confirmPendingFood(createAndAdd) : $emit('save')"
          @note="confirmPendingFood(addAsNote)"
          @cancel="rail = true; $emit('cancel')"
        />
      </v-card-actions>

      <!-- Rendered here rather than inside the dropdown: on a phone the on-screen keyboard
           and a long list of matches can push a dropdown's tail out of reach. The pair stays
           put and is relabelled by state, so the two available actions are always in view. -->
      <ShoppingListCreateItemActions
        v-if="!rail"
        row
        :primary-text="canCreateFood ? $t('shopping-list.create-and-add-to-list') : $t('shopping-list.add-to-list')"
        :primary-icon="canCreateFood ? $globals.icons.createAlt : $globals.icons.cartCheck"
        :secondary-text="canCreateFood ? $t('shopping-list.add-as-note') : $t('shopping-list.set-quantity-and-label')"
        :secondary-icon="canCreateFood ? $globals.icons.textBox : $globals.icons.edit"
        :disabled="!canCreateFood && !hasFood"
        @primary="canCreateFood ? confirmPendingFood(createAndAdd) : addSelectedFood()"
        @secondary="canCreateFood ? confirmPendingFood(addAsNote) : focusQuantity()"
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

// an existing food that the typed text names exactly, even if it was not picked from the list
const matchingFood = computed(() => {
  const search = foodSearch.value.trim().toLowerCase();
  return search ? props.foods.find(food => food.name.toLowerCase() === search) : undefined;
});
const hasFood = computed(() => !!listItem.value.foodId || !!matchingFood.value);

// "Add to list": put the selected (or exactly typed) food on the list as-is
function addSelectedFood() {
  if (!listItem.value.foodId && matchingFood.value) {
    listItem.value.food = matchingFood.value;
    listItem.value.foodId = matchingFood.value.id;
  }
  foodInputRef.value?.blur();
  emit("save");
  foodSearch.value = "";
}

// "Set quantity & label": move on to the details below before saving
function focusQuantity() {
  if (!listItem.value.foodId && matchingFood.value) {
    listItem.value.food = matchingFood.value;
    listItem.value.foodId = matchingFood.value.id;
  }
  foodInputRef.value?.blur();
  nextTick(() => {
    const quantityInput = fieldWrapper.value
      ?.closest(".v-navigation-drawer")
      ?.querySelector<HTMLInputElement>(".v-number-input input") ?? null;
    quantityInput?.focus();
    quantityInput?.select?.();
  });
}

const i18n = useI18n();
const { $globals } = useNuxtApp();
const rowButtons = computed(() => [
  {
    icon: $globals.icons.close,
    text: i18n.t("general.cancel"),
    event: "cancel",
  },
  ...(canCreateFood.value
    ? [{
        icon: $globals.icons.textBox,
        text: i18n.t("shopping-list.add-as-note"),
        event: "note",
      }]
    : []),
  {
    icon: $globals.icons.save,
    text: canCreateFood.value ? i18n.t("shopping-list.create-and-add-to-list") : i18n.t("general.save"),
    event: "save",
  },
]);

const { smAndDown } = useDisplay();
const menuDirection = computed(() => smAndDown.value ? "top" : "bottom");

// On phones the dropdown must fit in the space that is actually visible above the field.
// iOS in particular keeps the page layout full-height when the keyboard is up, so Vuetify
// would otherwise see "room" below the field, flip the dropdown downward, and put it under
// the keyboard. Measuring against the visual viewport keeps it above the field and on screen.
//
// Vuetify's own placement cannot be trusted here either: iOS reports viewport geometry
// inconsistently while the keyboard is up, and the dropdown still ended up below the field.
// So on phones the dropdown is attached inside the drawer and pinned above the field with
// plain CSS (see the style block), and only its height is measured. Whatever the keyboard
// does, content directly above a visible field is visible; at worst the top of a long list
// is clipped and scrolls, while the matches nearest the field stay in reach.
const fieldWrapper = ref<HTMLElement | null>(null);
const menuMaxHeight = ref<number | undefined>(undefined);
const MENU_MIN_HEIGHT = 120;
const MENU_MARGIN = 12;

function updateMenuMaxHeight() {
  if (!smAndDown.value || !fieldWrapper.value) {
    menuMaxHeight.value = undefined;
    return;
  }
  const visibleTop = window.visualViewport?.offsetTop ?? 0;
  const spaceAbove = Math.floor(fieldWrapper.value.getBoundingClientRect().top - visibleTop - MENU_MARGIN);
  menuMaxHeight.value = Math.max(MENU_MIN_HEIGHT, spaceAbove);
}

const menuProps = computed(() => smAndDown.value
  ? {
      attach: fieldWrapper.value ?? true,
      locationStrategy: "static" as const,
      maxHeight: menuMaxHeight.value,
      contentClass: "shopping-list-add-item-form__menu",
    }
  : { location: menuDirection.value });

onMounted(() => {
  const viewport = window.visualViewport ?? window;
  viewport.addEventListener("resize", updateMenuMaxHeight, { passive: true });
  viewport.addEventListener("scroll", updateMenuMaxHeight, { passive: true });
  onBeforeUnmount(() => {
    viewport.removeEventListener("resize", updateMenuMaxHeight);
    viewport.removeEventListener("scroll", updateMenuMaxHeight);
  });
});

const foodInputRef = ref<{ focus: () => void; blur: () => void } | null>(null);
const rail = ref(true);
// the field moves when the drawer expands, so re-measure the dropdown space then as well
watch(rail, () => nextTick(updateMenuMaxHeight));

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

<style scoped lang="scss">
/* The phone dropdown is attached inside the drawer (see menuProps) and pinned above the
   food field, so the drawer must let it overflow upward past its own edge. */
.shopping-list-add-item-form :deep(.v-navigation-drawer__content) {
  overflow: visible;
}

.shopping-list-add-item-form :deep(.shopping-list-add-item-form__menu) {
  position: absolute;
  top: auto !important;
  bottom: 100%;
  left: 0 !important;
  right: 0;
  width: 100%;
  margin-bottom: 4px;
}
</style>
