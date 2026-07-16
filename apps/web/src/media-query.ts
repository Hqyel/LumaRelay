import { queryOptions } from "@tanstack/react-query";

import { getMediaHome, getMediaLibraries } from "./api.js";

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
