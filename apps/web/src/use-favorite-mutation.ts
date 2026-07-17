import type { MediaCard } from "@newemby/contracts";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { setFavorite } from "./api.js";
import { updateFavoriteCache } from "./favorite-cache.js";

export interface FavoriteMutationInput {
  favorite: boolean;
  item: MediaCard;
}

interface FavoriteMutationContext {
  snapshots: [QueryKey, unknown][];
}

export function useFavoriteMutation() {
  const queryClient = useQueryClient();

  function update(input: FavoriteMutationInput, favorite: boolean) {
    queryClient.setQueriesData({ queryKey: ["media"] }, (value) =>
      updateFavoriteCache(value, input.item, favorite),
    );
  }

  return useMutation({
    mutationFn: ({ favorite, item }: FavoriteMutationInput) =>
      setFavorite(item.itemId, favorite),
    mutationKey: ["media", "favorite"],
    async onMutate(input): Promise<FavoriteMutationContext> {
      await queryClient.cancelQueries({ queryKey: ["media"] });
      const snapshots = queryClient.getQueriesData({ queryKey: ["media"] });
      update(input, input.favorite);
      return { snapshots };
    },
    onError(_error, _input, context) {
      for (const [queryKey, value] of context?.snapshots ?? [])
        queryClient.setQueryData(queryKey, value);
    },
    onSuccess(response, input) {
      update(input, response.state.isFavorite);
    },
  });
}
