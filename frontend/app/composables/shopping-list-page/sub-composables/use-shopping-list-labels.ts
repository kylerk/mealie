import type { ShoppingListOut } from "~/lib/api/types/household";

/**
 * Composable for managing shopping list label state and operations
 */
export function useShoppingListLabels(shoppingList: Ref<ShoppingListOut | null>) {
  const { t } = useI18n();

  const labelColorByName = computed(() => {
    // Build the lookup with a plain mutable accumulator. Spreading the accumulator on every
    // iteration copied the whole map once per item (O(n^2)), and this recomputes on every poll
    // tick and every item change.
    const colors: Record<string, string | undefined> = {};
    const items = shoppingList.value?.listItems ?? [];
    for (const { label } of items) {
      if (!label) {
        continue;
      }
      colors[label.name || t("shopping-list.no-label")] = label.color;
    }
    return colors;
  });

  function getLabelColor(label: string) {
    return labelColorByName.value[label];
  }

  return {
    getLabelColor,
  };
}
