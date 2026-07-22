import { queryOptions } from "@tanstack/react-query";

import {
  getMediaHome,
  getMediaItem,
  getMediaItems,
  getMediaLibraries,
  getSeriesEpisodes,
  getSeriesSeasons,
  searchMedia,
} from "./api.js";
import {
  mediaItemsFromSearch,
  type MediaBrowserSearch,
} from "./media-browser-search.js";

export const mediaHomeQuery = queryOptions({
  queryFn: getMediaHome,
  queryKey: ["media", "home"],
  refetchOnMount: "always",
  staleTime: 60_000,
});

export const mediaLibrariesQuery = queryOptions({
  queryFn: getMediaLibraries,
  queryKey: ["media", "libraries"],
  staleTime: 60_000,
});

export function moviesQuery(search: MediaBrowserSearch) {
  return queryOptions({
    queryFn: () =>
      getMediaItems(
        mediaItemsFromSearch(search, { kind: "movie", seriesStatus: "any" }),
      ),
    queryKey: ["media", "movies", search],
    staleTime: 60_000,
  });
}

export function seriesQuery(search: MediaBrowserSearch) {
  return queryOptions({
    queryFn: () =>
      getMediaItems(mediaItemsFromSearch(search, { kind: "series" })),
    queryKey: ["media", "series", search],
    staleTime: 60_000,
  });
}

export function libraryItemsQuery(
  libraryId: string,
  search: MediaBrowserSearch,
) {
  return queryOptions({
    queryFn: () =>
      getMediaItems(
        mediaItemsFromSearch(search, {
          kind:
            search.kind.length === 0
              ? ["movie", "series", "video"]
              : search.kind,
          libraryId,
        }),
      ),
    queryKey: ["media", "library", libraryId, search],
    staleTime: 60_000,
  });
}

export function mediaSearchQuery(searchTerm: string) {
  return queryOptions({
    enabled: searchTerm.trim() !== "",
    queryFn: () => searchMedia(searchTerm),
    queryKey: ["media", "search", searchTerm],
    staleTime: 60_000,
  });
}

export function mediaItemQuery(itemId: string) {
  return queryOptions({
    queryFn: () => getMediaItem(itemId),
    queryKey: ["media", "item", itemId],
    refetchOnMount: "always",
    staleTime: 5 * 60_000,
  });
}

export function seriesSeasonsQuery(seriesId: string) {
  return queryOptions({
    queryFn: () => getSeriesSeasons(seriesId),
    queryKey: ["media", "series", seriesId, "seasons"],
    staleTime: 5 * 60_000,
  });
}

export function seriesEpisodesQuery(
  seriesId: string,
  seasonId: string | undefined,
) {
  return queryOptions({
    enabled: seriesId !== "" && seasonId !== undefined,
    queryFn: () => {
      if (seasonId === undefined) throw new Error("Select a season first");
      return getSeriesEpisodes(seriesId, seasonId);
    },
    queryKey: ["media", "series", seriesId, "episodes", seasonId],
    refetchOnMount: "always",
    staleTime: 5 * 60_000,
  });
}
