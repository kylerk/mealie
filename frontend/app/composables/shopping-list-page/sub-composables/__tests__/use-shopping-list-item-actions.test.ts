import * as vuecore from "@vueuse/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ShoppingListQueue } from "../use-shopping-list-item-actions";
import { useShoppingListItemActions } from "../use-shopping-list-item-actions";
import { MOCK_ITEM, MOCK_SHOPPING_LIST } from "./mocks";

const getOne = vi.fn().mockResolvedValue({ data: MOCK_SHOPPING_LIST });

const deleteMany = vi.fn().mockImplementation(async () => { });
const updateMany = vi.fn().mockImplementation(async () => { });
const createMany = vi.fn().mockImplementation(async () => { });

vi.mock("@vueuse/core", { spy: true });
const isOnline = ref(true);
const storedValue = ref<{ [key: string]: ShoppingListQueue } | undefined>(undefined);
vi.mocked(vuecore.useOnline).mockReturnValue(isOnline);
vi.mocked(vuecore.useStorage).mockReturnValue(storedValue);

vi.mock("~/composables/api", () => ({
  useUserApi: () => ({
    shopping: {
      lists: { getOne },
      items: { deleteMany, updateMany, createMany },
    },
  }),
}));

describe("useShoppingListItemActions", () => {
  const {
    getList,
    createItem,
    deleteItem,
    updateItem,
    process,
    offlineCopySavedAt,
    lastSyncedAt,
    __testing__: { queue, clearQueueItems },
  } = useShoppingListItemActions("list_id");

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    isOnline.value = true;
    storedValue.value = undefined;
    clearQueueItems("all");
  });

  test("getList returns a shopping list", async () => {
    const list = await getList();
    expect(list).toBe(MOCK_SHOPPING_LIST);
    expect(offlineCopySavedAt.value).toBeNull();
    expect(lastSyncedAt.value).toBeTypeOf("number");
  });
  describe("offline copy", () => {
    test("getList falls back to the copy saved on the device when the server is unreachable", async () => {
      await getList(); // saves a copy
      getOne.mockResolvedValueOnce({ data: null, error: new Error("Network Error") });

      const list = await getList();
      expect(list?.id).toBe(MOCK_SHOPPING_LIST.id);
      expect(list?.listItems?.map(item => item.id)).toEqual(MOCK_SHOPPING_LIST.listItems?.map(item => item.id));
      expect(offlineCopySavedAt.value).toBeTypeOf("number");
    });
    test("queued changes are merged into the saved copy", async () => {
      await getList();
      getOne.mockResolvedValueOnce({ data: null, error: new Error("Network Error") });

      const checkedItem = { ...MOCK_ITEM, checked: true, updatedAt: "200" };
      updateItem(checkedItem);
      const newItem = { ...MOCK_ITEM, id: "new-item" };
      createItem(newItem);

      const list = await getList();
      expect(list?.listItems?.find(item => item.id === MOCK_ITEM.id)?.checked).toBe(true);
      expect(list?.listItems?.some(item => item.id === "new-item")).toBe(true);
    });
    test("getList returns nothing when there is no saved copy either", async () => {
      getOne.mockResolvedValueOnce({ data: null, error: new Error("Network Error") });
      expect(await getList()).toBeNull();
      expect(offlineCopySavedAt.value).toBeNull();
    });
    test("a successful fetch clears the offline marker", async () => {
      await getList();
      getOne.mockResolvedValueOnce({ data: null, error: new Error("Network Error") });
      await getList();
      expect(offlineCopySavedAt.value).not.toBeNull();

      await getList();
      expect(offlineCopySavedAt.value).toBeNull();
    });
  });
  test("create item creates an item", () => {
    createItem(MOCK_ITEM);
    expect(queue.create.includes(MOCK_ITEM));
  });
  describe("updateItem", () => {
    test("update item updates an item", () => {
      updateItem(MOCK_ITEM);
      expect(queue.update).include(MOCK_ITEM);
    });
    test("ignores a newly created item", () => {
      const updatedItem = { ...MOCK_ITEM, quantity: 2000 };
      createItem(MOCK_ITEM);
      updateItem(updatedItem);
      expect(queue.update).not.include(MOCK_ITEM);
      expect(queue.create).not.include(MOCK_ITEM);
      expect(queue.create).include(updatedItem);
    });
  });
  describe("deleteItem", () => {
    test("delete item deletes an item", () => {
      deleteItem(MOCK_ITEM);
      expect(queue.delete).include(MOCK_ITEM);
    });
    test("undoes a newly created item", () => {
      createItem(MOCK_ITEM);
      deleteItem(MOCK_ITEM);
      expect(queue.delete).not.include(MOCK_ITEM);
      expect(queue.create).not.include(MOCK_ITEM);
    });
  });
  describe("process processes the queue", () => {
    test("normally", async () => {
      const updatedItem = { ...MOCK_ITEM, id: "update" };
      const createdItem = { ...MOCK_ITEM, id: "create" };
      const deletedItem = { ...MOCK_ITEM, id: "delete" };

      updateItem(updatedItem);
      createItem(createdItem);
      deleteItem(deletedItem);

      await process();
      expect(queue.update).not.include(updatedItem);
      expect(queue.create).not.include(createdItem);
      expect(queue.delete).not.include(deletedItem);
    });
    test("clears the queue if there was an error merging", async () => {
      updateMany.mockThrowOnce("💥 Woe, exception be upon ye 💥");
      createMany.mockThrowOnce("💥 Woe, exception be upon ye 💥");
      deleteMany.mockThrowOnce("💥 Woe, exception be upon ye 💥");

      const updatedItem = { ...MOCK_ITEM, id: "update" };
      const createdItem = { ...MOCK_ITEM, id: "create" };
      const deletedItem = { ...MOCK_ITEM, id: "delete" };

      updateItem(updatedItem);
      createItem(createdItem);
      deleteItem(deletedItem);

      await process();
      expect(queue.update).not.include(updatedItem);
      expect(queue.create).not.include(createdItem);
      expect(queue.delete).not.include(deletedItem);
    });
    test("doesn't clear the queue when the browser says online but requests fail", async () => {
      const failed = { data: null, error: new Error("Network Error"), response: null };
      updateMany.mockResolvedValueOnce(failed);
      createMany.mockResolvedValueOnce(failed);
      deleteMany.mockResolvedValueOnce(failed);

      const updatedItem = { ...MOCK_ITEM, id: "update" };
      const createdItem = { ...MOCK_ITEM, id: "create" };
      const deletedItem = { ...MOCK_ITEM, id: "delete" };

      updateItem(updatedItem);
      createItem(createdItem);
      deleteItem(deletedItem);

      await process();
      expect(queue.update).include(updatedItem);
      expect(queue.create).include(createdItem);
      expect(queue.delete).include(deletedItem);
    });
    test("doesn't clear the queue if offline", async () => {
      isOnline.value = false;

      const updatedItem = { ...MOCK_ITEM, id: "update" };
      const createdItem = { ...MOCK_ITEM, id: "create" };
      const deletedItem = { ...MOCK_ITEM, id: "delete" };

      updateItem(updatedItem);
      createItem(createdItem);
      deleteItem(deletedItem);

      await process();
      expect(queue.update).include(updatedItem);
      expect(queue.create).include(createdItem);
      expect(queue.delete).include(deletedItem);
    });
    test("doesn't do anything if the queue is empty", async () => {
      await process();
      expect(updateMany).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    });
    test("doesn't do anything if we can't find the list", async () => {
      getOne.mockResolvedValue({ data: undefined });
      const updatedItem = { ...MOCK_ITEM, id: "update" };
      const createdItem = { ...MOCK_ITEM, id: "create" };
      const deletedItem = { ...MOCK_ITEM, id: "delete" };

      updateItem(updatedItem);
      createItem(createdItem);
      deleteItem(deletedItem);

      await process();
      expect(updateMany).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    });
  });
  describe("getQueue", () => {
    test("fetches from local storage if available", () => {
      const { queue, createEmptyQueue } = useShoppingListItemActions("list_id").__testing__;
      expect(queue).not.toEqual(createEmptyQueue);
    });
  });
});
