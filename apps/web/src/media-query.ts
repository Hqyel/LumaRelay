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

export const mediaHomeQuery = queryOptions({
  queryFn: getMediaHome,
  queryKey: ["media", "home"],
  staleTime: 60_000,
});

export const mediaLibrariesQuery = queryOptions({
  queryFn: getMediaLibraries,
  queryKey: ["media", "libraries"],
  staleTime: 60_000,
});

export function moviesQuery(page: number) {
  const limit = 40;
  return queryOptions({
    queryFn: () =>
      getMediaItems({
        kind: "movie",
        limit,
        sortBy: "dateAdded",
        sortOrder: "descending",
        startIndex: (page - 1) * limit,
      }),
    queryKey: ["media", "movies", { page }],
    staleTime: 60_000,
  });
}

export function seriesQuery(page: number) {
  const limit = 40;
  return queryOptions({
    queryFn: () =>
      getMediaItems({
        kind: "series",
        limit,
        sortBy: "dateAdded",
        sortOrder: "descending",
        startIndex: (page - 1) * limit,
      }),
    queryKey: ["media", "series", { page }],
    staleTime: 60_000,
  });
}

export function libraryItemsQuery(libraryId: string, page: number) {
  const limit = 40;
  return queryOptions({
    queryFn: () =>
      getMediaItems({
        kind: ["movie", "series", "video"],
        libraryId,
        limit,
        sortBy: "name",
        sortOrder: "ascending",
        startIndex: (page - 1) * limit,
      }),
    queryKey: ["media", "library", libraryId, { page }],
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
    enabled: seasonId !== undefined,
    queryFn: () => {
      if (seasonId === undefined) throw new Error("Select a season first");
      return getSeriesEpisodes(seriesId, seasonId);
    },
    queryKey: ["media", "series", seriesId, "episodes", seasonId],
    staleTime: 5 * 60_000,
  });
}
