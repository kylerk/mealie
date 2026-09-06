import type { ModelRef } from "vue";
import type { ShoppingListItemOut, ShoppingListItemCreate, IngredientFood } from "~/lib/api/types/household";
import { useFoodData, useFoodStore, useUnitData, useUnitStore } from "../store";

export function useShoppingListItemEditor(listItem: ModelRef<ShoppingListItemOut | ShoppingListItemCreate, string, ShoppingListItemOut | ShoppingListItemCreate, ShoppingListItemOut | ShoppingListItemCreate>) {
  const foodStore = useFoodStore();
  const foodData = useFoodData();

  const unitStore = useUnitStore();
  const unitData = useUnitData();

  async function createAssignFood(val: string) {
    // keep UI reactive
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    listItem.value.food ? (listItem.value.food.name = val) : (listItem.value.food = { name: val } as any);

    foodData.data.name = val;
    const newFood = await foodStore.actions.createOne(foodData.data);
    if (newFood) {
      listItem.value.food = newFood;
      listItem.value.foodId = newFood.id;
    }
    foodData.reset();
  }

  async function createAssignUnit(val: string) {
    // keep UI reactive
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    listItem.value.unit ? (listItem.value.unit.name = val) : (listItem.value.unit = { name: val } as any);

    unitData.data.name = val;
    const newUnit = await unitStore.actions.createOne(unitData.data);
    if (newUnit) {
      listItem.value.unit = newUnit;
      listItem.value.unitId = newUnit.id;
    }
    unitData.reset();
  }

  /**
   * Put free text on the item as a note instead of a food, so it can go on the
   * list without touching the food database.
   */
  function assignNote(val: string) {
    listItem.value.food = null;
    listItem.value.foodId = null;
    listItem.value.note = listItem.value.note ? `${val} ${listItem.value.note}` : val;
  }

  async function assignLabelToFood() {
    if (!(listItem.value.food && listItem.value.foodId && listItem.value.labelId)) {
      return;
    }

    listItem.value.food.labelId = listItem.value.labelId;
    await foodStore.actions.updateOne(listItem.value.food as IngredientFood);
  }

  return {
    assignLabelToFood,
    assignNote,
    createAssignFood,
    createAssignUnit,
  };
}
