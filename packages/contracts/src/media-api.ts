import { z } from "zod";

import { RequestIdSchema } from "./common.js";
import {
  EpisodeSummarySchema,
  MediaCardSchema,
  MediaDetailSchema,
  MediaKindSchema,
  MediaLibrarySchema,
  PersonSummarySchema,
  SeasonSummarySchema,
} from "./media.js";

const BooleanQuerySchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

export const MediaSortBySchema = z.enum([
  "name",
  "premiereDate",
  "dateAdded",
  "productionYear",
  "communityRating",
]);
export const SortOrderSchema = z.enum(["ascending", "descending"]);
export const PlayStateSchema = z.enum(["any", "played", "unplayed"]);
export const SeriesStatusSchema = z.enum(["any", "continuing", "ended"]);

export const MediaItemsQuerySchema = z.object({
  favorite: BooleanQuerySchema.optional(),
  genre: z.union([z.string(), z.array(z.string())]).optional(),
  kind: z.union([MediaKindSchema, z.array(MediaKindSchema)]).optional(),
  libraryId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  minCommunityRating: z.coerce.number().min(0).max(10).optional(),
  officialRating: z.union([z.string(), z.array(z.string())]).optional(),
  playState: PlayStateSchema.default("any"),
  seriesStatus: SeriesStatusSchema.default("any"),
  sortBy: MediaSortBySchema.default("name"),
  sortOrder: SortOrderSchema.default("ascending"),
  startIndex: z.coerce.number().int().nonnegative().default(0),
  year: z
    .union([
      z.coerce.number().int().min(1800).max(3000),
      z.array(z.coerce.number().int().min(1800).max(3000)),
    ])
    .optional(),
});

export const MediaItemParamsSchema = z.object({ itemId: z.string().min(1) });
export const SeriesParamsSchema = z.object({ seriesId: z.string().min(1) });
export const SeriesEpisodesQuerySchema = z.object({
  seasonId: z.string().min(1),
});
export const MediaSearchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).default(8),
  q: z.string().trim().min(1).max(200),
});

export const ImageTypeSchema = z.enum(["primary", "backdrop", "logo", "thumb"]);
export const ImagePresetSchema = z.enum([
  "poster",
  "card",
  "hero",
  "avatar",
  "logo",
]);
export const MediaImageParamsSchema = MediaItemParamsSchema.extend({
  imageType: ImageTypeSchema,
});
export const MediaImageQuerySchema = z.object({
  dpr: z.coerce.number().int().min(1).max(2).default(1),
  index: z.coerce.number().int().nonnegative().optional(),
  preset: ImagePresetSchema,
  tag: z.string().min(1).max(256),
});

export const MediaUserStateSchema = z.object({
  isFavorite: z.boolean(),
  isPlayed: z.boolean(),
  itemId: z.string().min(1),
  playbackPositionSeconds: z.number().int().nonnegative(),
  playedPercentage: z.number().min(0).max(100).optional(),
  serverId: z.string().min(1),
});
export const FavoriteRequestSchema = z.object({ favorite: z.boolean() });
export const PlayedRequestSchema = z.object({ played: z.boolean() });
export const MediaUserStateResponseSchema = z.object({
  requestId: RequestIdSchema,
  state: MediaUserStateSchema,
});

export const GenreRowSchema = z.object({
  genre: z.string().min(1),
  items: z.array(MediaCardSchema),
});
export const MediaHomeResponseSchema = z.object({
  favoriteItems: z.array(MediaCardSchema),
  genreRows: z.array(GenreRowSchema).max(2),
  hero: MediaDetailSchema.nullable(),
  latestMovies: z.array(MediaCardSchema),
  latestSeries: z.array(MediaCardSchema),
  requestId: RequestIdSchema,
  resumeItems: z.array(MediaCardSchema),
});
export const MediaLibrariesResponseSchema = z.object({
  libraries: z.array(MediaLibrarySchema),
  requestId: RequestIdSchema,
});
export const PagedMediaResponseSchema = z.object({
  items: z.array(MediaCardSchema),
  limit: z.number().int().positive(),
  requestId: RequestIdSchema,
  startIndex: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export const MediaItemResponseSchema = z.object({
  item: MediaDetailSchema,
  people: z.array(PersonSummarySchema),
  relatedItems: z.array(MediaCardSchema),
  requestId: RequestIdSchema,
});
export const MediaSearchResponseSchema = z.object({
  episodes: z.array(MediaCardSchema),
  movies: z.array(MediaCardSchema),
  people: z.array(PersonSummarySchema),
  requestId: RequestIdSchema,
  series: z.array(MediaCardSchema),
});
export const SeasonsResponseSchema = z.object({
  requestId: RequestIdSchema,
  seasons: z.array(SeasonSummarySchema),
});
export const EpisodesResponseSchema = z.object({
  episodes: z.array(EpisodeSummarySchema),
  requestId: RequestIdSchema,
});

export type MediaItemsQuery = z.infer<typeof MediaItemsQuerySchema>;
export type MediaHomeResponse = z.infer<typeof MediaHomeResponseSchema>;
export type MediaLibrariesResponse = z.infer<
  typeof MediaLibrariesResponseSchema
>;
export type PagedMediaResponse = z.infer<typeof PagedMediaResponseSchema>;
export type MediaItemResponse = z.infer<typeof MediaItemResponseSchema>;
export type MediaSearchResponse = z.infer<typeof MediaSearchResponseSchema>;
export type MediaUserState = z.infer<typeof MediaUserStateSchema>;
export type MediaUserStateResponse = z.infer<
  typeof MediaUserStateResponseSchema
>;
export type SeasonsResponse = z.infer<typeof SeasonsResponseSchema>;
export type EpisodesResponse = z.infer<typeof EpisodesResponseSchema>;
