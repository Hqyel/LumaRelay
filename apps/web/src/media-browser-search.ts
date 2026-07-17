import type { MediaItemsQuery, MediaKind } from "@newemby/contracts";

export interface MediaBrowserSearch {
  favorite?: true;
  genre: string[];
  kind: MediaKind[];
  libraryId?: string;
  minCommunityRating?: number;
  officialRating: string[];
  page: number;
  playState: MediaItemsQuery["playState"];
  seriesStatus: MediaItemsQuery["seriesStatus"];
  sortBy: MediaItemsQuery["sortBy"];
  sortOrder: MediaItemsQuery["sortOrder"];
  year: number[];
}

export interface MediaBrowserDefaults {
  sortBy: MediaItemsQuery["sortBy"];
  sortOrder: MediaItemsQuery["sortOrder"];
}

export const latestMediaBrowserDefaults = {
  sortBy: "dateAdded",
  sortOrder: "descending",
} as const satisfies MediaBrowserDefaults;

export const libraryMediaBrowserDefaults = {
  sortBy: "name",
  sortOrder: "ascending",
} as const satisfies MediaBrowserDefaults;

function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function stringValues(value: unknown): string[] {
  return [
    ...new Set(
      values(value)
        .flatMap((entry) => String(entry).split(","))
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const candidate = String(value);
  return allowed.includes(candidate as T) ? (candidate as T) : fallback;
}

export function parseMediaBrowserSearch(
  search: Record<string, unknown>,
  defaults: MediaBrowserDefaults,
): MediaBrowserSearch {
  const page = Number(search.page);
  const minCommunityRating = Number(search.minCommunityRating);
  const year = [
    ...new Set(
      values(search.year)
        .flatMap((entry) => String(entry).split(","))
        .map(Number)
        .filter(
          (entry) => Number.isInteger(entry) && entry >= 1800 && entry <= 3000,
        ),
    ),
  ].sort((left, right) => left - right);
  const allowedKinds = [
    "movie",
    "series",
    "episode",
    "video",
    "boxSet",
    "playlist",
    "unknown",
  ] as const;

  return {
    favorite:
      search.favorite === true || search.favorite === "true" ? true : undefined,
    genre: stringValues(search.genre),
    kind: stringValues(search.kind).filter((entry): entry is MediaKind =>
      allowedKinds.includes(entry as MediaKind),
    ),
    libraryId:
      typeof search.libraryId === "string" && search.libraryId.trim() !== ""
        ? search.libraryId.trim()
        : undefined,
    minCommunityRating:
      Number.isFinite(minCommunityRating) &&
      minCommunityRating >= 0 &&
      minCommunityRating <= 10
        ? minCommunityRating
        : undefined,
    officialRating: stringValues(search.officialRating),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    playState: enumValue(
      search.playState,
      ["any", "played", "unplayed"],
      "any",
    ),
    seriesStatus: enumValue(
      search.seriesStatus,
      ["any", "continuing", "ended"],
      "any",
    ),
    sortBy: enumValue(
      search.sortBy,
      [
        "name",
        "premiereDate",
        "dateAdded",
        "productionYear",
        "communityRating",
      ],
      defaults.sortBy,
    ),
    sortOrder: enumValue(
      search.sortOrder,
      ["ascending", "descending"],
      defaults.sortOrder,
    ),
    year,
  };
}

export function mediaItemsFromSearch(
  search: MediaBrowserSearch,
  fixed: Partial<MediaItemsQuery> = {},
): MediaItemsQuery {
  const limit = 40;
  return {
    favorite: search.favorite,
    genre: search.genre.length === 0 ? undefined : search.genre,
    kind: fixed.kind ?? (search.kind.length === 0 ? undefined : search.kind),
    libraryId: fixed.libraryId ?? search.libraryId,
    limit,
    minCommunityRating: search.minCommunityRating,
    officialRating:
      search.officialRating.length === 0 ? undefined : search.officialRating,
    playState: search.playState,
    seriesStatus: fixed.seriesStatus ?? search.seriesStatus,
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
    startIndex: (search.page - 1) * limit,
    year: search.year.length === 0 ? undefined : search.year,
  };
}
