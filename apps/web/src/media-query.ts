import { queryOptions } from "@tanstack/react-query";

import { getMediaHome, getMediaItems, getMediaLibraries } from "./api.js";

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
