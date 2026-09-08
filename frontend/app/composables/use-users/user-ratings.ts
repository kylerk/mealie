import { useUserApi } from "~/composables/api";
import type { UserRatingSummary } from "~/lib/api/types/user";

const userRatings = ref<UserRatingSummary[]>([]);
// indexed once per change so every recipe card can look up its rating in O(1) instead of scanning
// the whole list (cards x ratings comparisons on every render)
const userRatingsByRecipeId = computed(() => {
  const byId = new Map<string, UserRatingSummary>();
  for (const rating of userRatings.value) {
    byId.set(rating.recipeId, rating);
  }
  return byId;
});
const loading = ref(false);
const ready = ref(false);

export function resetUserSelfRatings() {
  userRatings.value = [];
  loading.value = false;
  ready.value = false;
}

export const useUserSelfRatings = function () {
  const auth = useMealieAuth();

  async function refreshUserRatings() {
    if (!auth.user.value || loading.value) {
      return;
    }

    loading.value = true;
    const api = useUserApi();

    const { data } = await api.users.getSelfRatings();
    userRatings.value = data?.ratings || [];

    loading.value = false;
    ready.value = true;
  }

  async function setRating(slug: string, rating: number | null, isFavorite: boolean | null) {
    loading.value = true;
    const api = useUserApi();

    const userId = auth.user.value?.id || "";
    await api.users.setRating(userId, slug, rating, isFavorite);

    loading.value = false;
    await refreshUserRatings();
  }

  if (!ready.value) {
    refreshUserRatings();
  }

  return {
    userRatings,
    userRatingsByRecipeId,
    refreshUserRatings,
    setRating,
    ready,
  };
};
