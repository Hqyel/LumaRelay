import type { MediaCard } from "@lumarelay/contracts";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { setPlayed } from "./api.js";
import { updateMediaStateCache } from "./media-state-cache.js";

export interface PlayedMutationInput {
  item: MediaCard;
  played: boolean;
}

interface PlayedMutationContext {
  snapshots: [QueryKey, unknown][];
}

export function usePlayedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ item, played }: PlayedMutationInput) =>
      setPlayed(item.itemId, played),
    mutationKey: ["media", "played"],
    async onMutate(input): Promise<PlayedMutationContext> {
      await queryClient.cancelQueries({ queryKey: ["media"] });
      const snapshots = queryClient.getQueriesData({ queryKey: ["media"] });
      queryClient.setQueriesData({ queryKey: ["media"] }, (value) =>
        updateMediaStateCache(value, input.item, {
          isPlayed: input.played,
          playbackPositionSeconds: input.played
            ? input.item.playbackPositionSeconds
            : 0,
          playedPercentage: input.played ? 100 : 0,
        }),
      );
      return { snapshots };
    },
    onError(_error, _input, context) {
      for (const [queryKey, value] of context?.snapshots ?? [])
        queryClient.setQueryData(queryKey, value);
    },
    onSuccess(response, input) {
      queryClient.setQueriesData({ queryKey: ["media"] }, (value) =>
        updateMediaStateCache(value, input.item, response.state),
      );
    },
  });
}
