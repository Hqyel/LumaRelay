import {
  type EpisodesResponse,
  MediaHomeResponseSchema,
  type MediaCard,
  type MediaDetail,
  type MediaHomeResponse,
  type MediaItemResponse,
  type MediaItemsQuery,
  type MediaLibrary,
  type MediaSearchResponse,
  type MediaUserState,
  type PagedMediaResponse,
  type SeasonsResponse,
} from "@newemby/contracts";
import { z } from "zod";

import {
  buildEmbyImageUrl,
  resolveImageSize,
  type EmbyImageType,
  type ImageSizePreset,
} from "./image.js";
import {
  EmbyBaseItemDtoSchema,
  toMediaCard,
  toMediaDetail,
  toMediaLibrary,
  toEpisodeSummary,
  toPersonSummary,
  toSeasonSummary,
  type EmbyBaseItemDto,
} from "./media-adapters.js";
import { embyApiUrl } from "./url.js";

const EmbyItemsResponseSchema = z.object({
  Items: z.array(EmbyBaseItemDtoSchema),
  StartIndex: z.number().int().nonnegative().optional(),
  TotalRecordCount: z.number().int().nonnegative().optional(),
});

const HOME_FIELDS = [
  "BackdropImageTags",
  "CommunityRating",
  "DateLastMediaAdded",
  "Genres",
  "ImageTags",
  "OfficialRating",
  "Overview",
  "People",
  "PremiereDate",
  "ProductionYear",
  "RunTimeTicks",
  "Taglines",
  "UserData",
].join(",");

export type EmbyMediaErrorKind =
  | "forbidden"
  | "invalid-response"
  | "not-found"
  | "timeout"
  | "unauthorized"
  | "unreachable"
  | "write-failed";

export class EmbyMediaError extends Error {
  constructor(
    readonly kind: EmbyMediaErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmbyMediaError";
  }
}

export interface AuthenticatedMediaRequest {
  accessToken: string;
  deviceId: string;
  serverId: string;
  userId: string;
}

export interface MediaClientOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface AuthenticatedImageRequest {
  dpr: 1 | 2;
  imageTag: string;
  imageType: "primary" | "backdrop" | "logo" | "thumb";
  index?: number;
  itemId: string;
  preset: "poster" | "card" | "hero" | "avatar" | "logo";
}

export interface AuthenticatedImage {
  body: ArrayBuffer;
  cacheControl?: string;
  contentType: string;
  etag?: string;
}

function values<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function embyItemType(kind: string): string | undefined {
  const types: Record<string, string> = {
    boxSet: "BoxSet",
    episode: "Episode",
    movie: "Movie",
    playlist: "Playlist",
    series: "Series",
    video: "Video",
  };
  return types[kind];
}

function embySortBy(sortBy: MediaItemsQuery["sortBy"]): string {
  return {
    communityRating: "CommunityRating",
    dateAdded: "DateCreated",
    name: "SortName",
    premiereDate: "PremiereDate",
    productionYear: "ProductionYear",
  }[sortBy];
}

function authorizationHeader(deviceId: string): string {
  const safeDeviceId = deviceId.replace(/["\\]/g, "");
  return (
    'Emby Client="NewEmby", Device="Gateway", ' +
    `DeviceId="${safeDeviceId}", Version="0.0.0"`
  );
}

export function authenticatedHeaders(input: AuthenticatedMediaRequest) {
  return {
    accept: "application/json",
    "x-emby-authorization": authorizationHeader(input.deviceId),
    "x-emby-token": input.accessToken,
  };
}

export async function fetchEmby(
  url: URL,
  input: AuthenticatedMediaRequest,
  options: MediaClientOptions,
  accept = "application/json",
  headers: Record<string, string> = {},
  request: Pick<RequestInit, "body" | "method"> = {},
): Promise<Response> {
  const fetcher = options.fetch ?? globalThis.fetch;

  try {
    const response = await fetcher(url, {
      ...request,
      headers: { ...authenticatedHeaders(input), ...headers, accept },
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
    });

    if (response.status === 401)
      throw new EmbyMediaError("unauthorized", "The Emby session has expired");
    if (response.status === 403)
      throw new EmbyMediaError("forbidden", "This media is not available");
    if (response.status === 404)
      throw new EmbyMediaError("not-found", "The media item was not found");
    if (!response.ok)
      throw new EmbyMediaError("unreachable", "The Emby request failed");

    return response;
  } catch (error) {
    if (error instanceof EmbyMediaError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new EmbyMediaError("timeout", "The Emby request timed out", {
        cause: error,
      });
    throw new EmbyMediaError("unreachable", "The Emby server is unreachable", {
      cause: error,
    });
  }
}

async function writeEmby(
  url: URL,
  input: AuthenticatedMediaRequest,
  method: "DELETE" | "POST",
  options: MediaClientOptions,
): Promise<void> {
  const fetcher = options.fetch ?? globalThis.fetch;

  try {
    const response = await fetcher(url, {
      headers: {
        ...authenticatedHeaders(input),
        accept: "application/json",
      },
      method,
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
    });

    if (response.status === 401)
      throw new EmbyMediaError("unauthorized", "The Emby session has expired");
    if (response.status === 403)
      throw new EmbyMediaError("forbidden", "This media is not available");
    if (response.status === 404)
      throw new EmbyMediaError("not-found", "The media item was not found");
    if (!response.ok)
      throw new EmbyMediaError("write-failed", "The Emby write failed");
  } catch (error) {
    if (error instanceof EmbyMediaError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new EmbyMediaError("timeout", "The Emby write timed out", {
        cause: error,
      });
    throw new EmbyMediaError("write-failed", "The Emby write failed", {
      cause: error,
    });
  }
}

function listUrl(
  baseUrl: string,
  userId: string,
  suffix: string,
  params: Record<string, string>,
): URL {
  const url = embyApiUrl(
    baseUrl,
    `/Users/${encodeURIComponent(userId)}/Items${suffix}`,
  );
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  return url;
}

async function readItemsResponse(
  response: Response,
): Promise<EmbyBaseItemDto[]> {
  const parsed = EmbyItemsResponseSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new EmbyMediaError(
      "invalid-response",
      "The Emby media response is invalid",
    );
  return parsed.data.Items;
}

async function getUserItem(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  itemId: string,
  options: MediaClientOptions,
): Promise<EmbyBaseItemDto> {
  const url = embyApiUrl(
    baseUrl,
    `/Users/${encodeURIComponent(input.userId)}/Items/${encodeURIComponent(itemId)}`,
  );
  url.searchParams.set("EnableUserData", "true");
  const parsed = EmbyBaseItemDtoSchema.safeParse(
    await (await fetchEmby(url, input, options)).json(),
  );
  if (!parsed.success)
    throw new EmbyMediaError(
      "invalid-response",
      "The Emby user item response is invalid",
    );
  return parsed.data;
}

function mediaUserState(
  item: EmbyBaseItemDto,
  serverId: string,
): MediaUserState {
  const card = toMediaCard(item, serverId);
  return {
    isFavorite: card.isFavorite,
    isPlayed: card.isPlayed,
    itemId: card.itemId,
    playbackPositionSeconds: card.playbackPositionSeconds,
    playedPercentage: card.playedPercentage,
    serverId,
  };
}

async function readLatestResponse(
  response: Response,
): Promise<EmbyBaseItemDto[]> {
  const parsed = z
    .array(EmbyBaseItemDtoSchema)
    .safeParse(await response.json());
  if (!parsed.success)
    throw new EmbyMediaError(
      "invalid-response",
      "The Emby latest media response is invalid",
    );
  return parsed.data;
}

async function homeItems(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  options: MediaClientOptions,
  mode: "favorite" | "latest-movies" | "latest-series" | "resume",
): Promise<EmbyBaseItemDto[]> {
  const common = {
    EnableImages: "true",
    EnableUserData: "true",
    Fields: HOME_FIELDS,
    ImageTypeLimit: "2",
    Limit: mode === "resume" ? "12" : "18",
  };
  let url: URL;

  if (mode === "latest-movies" || mode === "latest-series") {
    url = listUrl(baseUrl, input.userId, "/Latest", {
      ...common,
      IncludeItemTypes: mode === "latest-movies" ? "Movie" : "Series",
    });
    return readLatestResponse(await fetchEmby(url, input, options));
  }

  if (mode === "resume") {
    url = listUrl(baseUrl, input.userId, "/Resume", {
      ...common,
      IncludeItemTypes: "Movie,Episode",
      Recursive: "true",
    });
  } else {
    url = listUrl(baseUrl, input.userId, "", {
      ...common,
      Filters: "IsFavorite",
      IncludeItemTypes: "Movie,Series",
      Recursive: "true",
      SortBy: "DateCreated",
      SortOrder: "Descending",
    });
  }

  return readItemsResponse(await fetchEmby(url, input, options));
}

function heroFrom(
  resume: EmbyBaseItemDto[],
  movies: EmbyBaseItemDto[],
  series: EmbyBaseItemDto[],
  serverId: string,
): MediaDetail | null {
  const candidates = [...resume, ...movies, ...series];
  const selected =
    candidates.find((item) => (item.BackdropImageTags?.length ?? 0) > 0) ??
    candidates[0];
  return selected === undefined ? null : toMediaDetail(selected, serverId);
}

function genreRows(
  source: EmbyBaseItemDto[],
  serverId: string,
): Array<{ genre: string; items: MediaCard[] }> {
  const counts = new Map<string, number>();
  for (const item of source) {
    for (const genre of item.Genres ?? []) {
      const normalized = genre.trim();
      if (normalized !== "")
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, 2)
    .map(([genre]) => ({
      genre,
      items: source
        .filter((item) => item.Genres?.some((value) => value.trim() === genre))
        .slice(0, 12)
        .map((item) => toMediaCard(item, serverId)),
    }));
}

export async function getMediaHome(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  options: MediaClientOptions = {},
): Promise<Omit<MediaHomeResponse, "requestId">> {
  const [resume, latestMovies, latestSeries, favorites] = await Promise.all([
    homeItems(baseUrl, input, options, "resume"),
    homeItems(baseUrl, input, options, "latest-movies"),
    homeItems(baseUrl, input, options, "latest-series"),
    homeItems(baseUrl, input, options, "favorite"),
  ]);
  const discovery = [...latestMovies, ...latestSeries, ...favorites];

  return MediaHomeResponseSchema.omit({ requestId: true }).parse({
    favoriteItems: favorites.map((item) => toMediaCard(item, input.serverId)),
    genreRows: genreRows(discovery, input.serverId),
    hero: heroFrom(resume, latestMovies, latestSeries, input.serverId),
    latestMovies: latestMovies.map((item) => toMediaCard(item, input.serverId)),
    latestSeries: latestSeries.map((item) => toMediaCard(item, input.serverId)),
    resumeItems: resume.map((item) => toMediaCard(item, input.serverId)),
  });
}

export async function getMediaLibraries(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  options: MediaClientOptions = {},
): Promise<MediaLibrary[]> {
  const url = embyApiUrl(
    baseUrl,
    `/Users/${encodeURIComponent(input.userId)}/Views`,
  );
  url.searchParams.set("EnableImages", "true");
  const items = await readItemsResponse(await fetchEmby(url, input, options));
  return items.map((item) => toMediaLibrary(item, input.serverId));
}

export async function getMediaItems(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  query: MediaItemsQuery,
  options: MediaClientOptions = {},
): Promise<Omit<PagedMediaResponse, "requestId">> {
  const kinds = values(query.kind)
    .map(embyItemType)
    .filter((value): value is string => value !== undefined);
  const filters: string[] = [];
  if (query.favorite === true) filters.push("IsFavorite");
  if (query.playState === "played") filters.push("IsPlayed");
  if (query.playState === "unplayed") filters.push("IsUnplayed");
  const url = listUrl(baseUrl, input.userId, "", {
    EnableImages: "true",
    EnableTotalRecordCount: "true",
    EnableUserData: "true",
    Fields: HOME_FIELDS,
    ImageTypeLimit: "2",
    Limit: String(query.limit),
    Recursive: "true",
    SortBy: embySortBy(query.sortBy),
    SortOrder: query.sortOrder === "ascending" ? "Ascending" : "Descending",
    StartIndex: String(query.startIndex),
  });
  if (kinds.length > 0)
    url.searchParams.set("IncludeItemTypes", kinds.join(","));
  if (query.libraryId !== undefined)
    url.searchParams.set("ParentId", query.libraryId);
  if (filters.length > 0) url.searchParams.set("Filters", filters.join(","));
  const genres = values(query.genre);
  if (genres.length > 0) url.searchParams.set("Genres", genres.join("|"));
  const years = values(query.year);
  if (years.length > 0) url.searchParams.set("Years", years.join(","));
  const ratings = values(query.officialRating);
  if (ratings.length > 0)
    url.searchParams.set("OfficialRatings", ratings.join("|"));
  if (query.minCommunityRating !== undefined)
    url.searchParams.set(
      "MinCommunityRating",
      String(query.minCommunityRating),
    );
  if (query.seriesStatus !== "any")
    url.searchParams.set(
      "SeriesStatus",
      query.seriesStatus === "continuing" ? "Continuing" : "Ended",
    );

  const response = await fetchEmby(url, input, options);
  const parsed = EmbyItemsResponseSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new EmbyMediaError(
      "invalid-response",
      "The Emby media response is invalid",
    );

  return {
    items: parsed.data.Items.map((item) => toMediaCard(item, input.serverId)),
    limit: query.limit,
    startIndex: parsed.data.StartIndex ?? query.startIndex,
    total: parsed.data.TotalRecordCount ?? parsed.data.Items.length,
  };
}

export async function searchMedia(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  query: { limit: number; q: string },
  options: MediaClientOptions = {},
): Promise<Omit<MediaSearchResponse, "requestId">> {
  const mediaUrl = listUrl(baseUrl, input.userId, "", {
    EnableImages: "true",
    EnableUserData: "true",
    Fields: HOME_FIELDS,
    IncludeItemTypes: "Movie,Series,Episode",
    Limit: String(query.limit * 3),
    Recursive: "true",
    SearchTerm: query.q,
  });
  const peopleUrl = embyApiUrl(baseUrl, "/Persons");
  peopleUrl.searchParams.set("EnableImages", "true");
  peopleUrl.searchParams.set("Fields", "PrimaryImageAspectRatio");
  peopleUrl.searchParams.set("Limit", String(query.limit));
  peopleUrl.searchParams.set("SearchTerm", query.q);
  peopleUrl.searchParams.set("UserId", input.userId);

  const [media, people] = await Promise.all([
    readItemsResponse(await fetchEmby(mediaUrl, input, options)),
    readItemsResponse(await fetchEmby(peopleUrl, input, options)),
  ]);
  const cards = media.map((item) => toMediaCard(item, input.serverId));

  return {
    episodes: cards
      .filter((item) => item.kind === "episode")
      .slice(0, query.limit),
    movies: cards.filter((item) => item.kind === "movie").slice(0, query.limit),
    people: people
      .map((person) => toPersonSummary(person, input.serverId))
      .slice(0, query.limit),
    series: cards
      .filter((item) => item.kind === "series")
      .slice(0, query.limit),
  };
}

export async function getMediaItem(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  itemId: string,
  options: MediaClientOptions = {},
): Promise<Omit<MediaItemResponse, "requestId">> {
  const itemUrl = embyApiUrl(
    baseUrl,
    `/Users/${encodeURIComponent(input.userId)}/Items/${encodeURIComponent(itemId)}`,
  );
  itemUrl.searchParams.set("Fields", HOME_FIELDS);
  const relatedUrl = embyApiUrl(
    baseUrl,
    `/Items/${encodeURIComponent(itemId)}/Similar`,
  );
  relatedUrl.searchParams.set("EnableImages", "true");
  relatedUrl.searchParams.set("EnableUserData", "true");
  relatedUrl.searchParams.set("Fields", HOME_FIELDS);
  relatedUrl.searchParams.set("Limit", "12");
  relatedUrl.searchParams.set("UserId", input.userId);

  const [itemResponse, related] = await Promise.all([
    fetchEmby(itemUrl, input, options),
    readItemsResponse(await fetchEmby(relatedUrl, input, options)),
  ]);
  const parsed = EmbyBaseItemDtoSchema.safeParse(await itemResponse.json());
  if (!parsed.success)
    throw new EmbyMediaError(
      "invalid-response",
      "The Emby media detail response is invalid",
    );

  return {
    item: toMediaDetail(parsed.data, input.serverId),
    people: (parsed.data.People ?? []).map((person) =>
      toPersonSummary(
        EmbyBaseItemDtoSchema.parse({ ...person, ImageTags: {} }),
        input.serverId,
      ),
    ),
    relatedItems: related.map((item) => toMediaCard(item, input.serverId)),
  };
}

export async function getSeriesSeasons(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  seriesId: string,
  options: MediaClientOptions = {},
): Promise<Omit<SeasonsResponse, "requestId">> {
  const url = embyApiUrl(
    baseUrl,
    `/Shows/${encodeURIComponent(seriesId)}/Seasons`,
  );
  url.searchParams.set("EnableImages", "true");
  url.searchParams.set("EnableUserData", "true");
  url.searchParams.set("Fields", HOME_FIELDS);
  url.searchParams.set("UserId", input.userId);

  return {
    seasons: (
      await readItemsResponse(await fetchEmby(url, input, options))
    ).map((season) => toSeasonSummary(season, input.serverId)),
  };
}

export async function getSeriesEpisodes(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  seriesId: string,
  seasonId: string,
  options: MediaClientOptions = {},
): Promise<Omit<EpisodesResponse, "requestId">> {
  const url = embyApiUrl(
    baseUrl,
    `/Shows/${encodeURIComponent(seriesId)}/Episodes`,
  );
  url.searchParams.set("EnableImages", "true");
  url.searchParams.set("EnableUserData", "true");
  url.searchParams.set("Fields", HOME_FIELDS);
  url.searchParams.set("SeasonId", seasonId);
  url.searchParams.set("UserId", input.userId);

  return {
    episodes: (
      await readItemsResponse(await fetchEmby(url, input, options))
    ).map((episode) => toEpisodeSummary(episode, input.serverId)),
  };
}

export async function setFavoriteState(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  itemId: string,
  favorite: boolean,
  options: MediaClientOptions = {},
): Promise<MediaUserState> {
  const current = await getUserItem(baseUrl, input, itemId, options);
  if ((current.UserData?.IsFavorite === true) === favorite)
    return mediaUserState(current, input.serverId);

  const url = embyApiUrl(
    baseUrl,
    `/Users/${encodeURIComponent(input.userId)}/FavoriteItems/${encodeURIComponent(itemId)}`,
  );
  await writeEmby(url, input, favorite ? "POST" : "DELETE", options);
  return mediaUserState(
    await getUserItem(baseUrl, input, itemId, options),
    input.serverId,
  );
}

export async function setPlayedState(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  itemId: string,
  played: boolean,
  options: MediaClientOptions = {},
): Promise<MediaUserState> {
  const current = await getUserItem(baseUrl, input, itemId, options);
  if ((current.UserData?.Played === true) === played)
    return mediaUserState(current, input.serverId);

  const url = embyApiUrl(
    baseUrl,
    `/Users/${encodeURIComponent(input.userId)}/PlayedItems/${encodeURIComponent(itemId)}`,
  );
  await writeEmby(url, input, played ? "POST" : "DELETE", options);
  return mediaUserState(
    await getUserItem(baseUrl, input, itemId, options),
    input.serverId,
  );
}

function imageType(
  value: AuthenticatedImageRequest["imageType"],
): EmbyImageType {
  return `${value[0]?.toUpperCase()}${value.slice(1)}` as EmbyImageType;
}

function imagePreset(
  value: AuthenticatedImageRequest["preset"],
): ImageSizePreset {
  if (value === "card") return "landscape";
  if (value === "hero") return "backdrop";
  return value;
}

export async function loadAuthenticatedImage(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  request: AuthenticatedImageRequest,
  options: MediaClientOptions = {},
): Promise<AuthenticatedImage> {
  const widths = { avatar: 192, card: 640, hero: 1280, logo: 480, poster: 240 };
  const url = buildEmbyImageUrl(baseUrl, {
    imageTag: request.imageTag,
    imageType: imageType(request.imageType),
    index: request.index,
    itemId: request.itemId,
    quality: 90,
    size: resolveImageSize(
      imagePreset(request.preset),
      widths[request.preset],
      request.dpr,
    ),
  });
  const response = await fetchEmby(url, input, options, "image/*");

  return {
    body: await response.arrayBuffer(),
    cacheControl: response.headers.get("cache-control") ?? undefined,
    contentType: response.headers.get("content-type") ?? "image/jpeg",
    etag: response.headers.get("etag") ?? undefined,
  };
}
