import { z } from "zod";

export const MediaKindSchema = z.enum([
  "movie",
  "series",
  "episode",
  "video",
  "boxSet",
  "playlist",
  "unknown",
]);

export const MediaLibraryKindSchema = z.enum([
  "movies",
  "series",
  "mixed",
  "music",
  "photos",
  "books",
  "unknown",
]);

export const MediaLibrarySchema = z.object({
  itemCount: z.number().int().nonnegative().optional(),
  kind: MediaLibraryKindSchema,
  libraryId: z.string().min(1),
  name: z.string().min(1),
  primaryImageTag: z.string().min(1).optional(),
  serverId: z.string().min(1),
});

export const MediaCardSchema = z.object({
  backdropImageTag: z.string().min(1).optional(),
  communityRating: z.number().nonnegative().optional(),
  episodeNumber: z.number().int().nonnegative().optional(),
  isFavorite: z.boolean(),
  isPlayed: z.boolean(),
  itemId: z.string().min(1),
  kind: MediaKindSchema,
  latestEpisodeDate: z.iso.datetime().optional(),
  officialRating: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  playbackPositionSeconds: z.number().int().nonnegative(),
  playedPercentage: z.number().min(0).max(100).optional(),
  primaryImageTag: z.string().min(1).optional(),
  productionYear: z.number().int().nonnegative().optional(),
  runtimeSeconds: z.number().int().nonnegative().optional(),
  seasonId: z.string().min(1).optional(),
  seasonNumber: z.number().int().nonnegative().optional(),
  serverId: z.string().min(1),
  seriesId: z.string().min(1).optional(),
  seriesStatus: z.enum(["continuing", "ended"]).optional(),
  subtitle: z.string().min(1).optional(),
  title: z.string().min(1),
  unplayedItemCount: z.number().int().nonnegative().optional(),
});

export const MediaDetailSchema = MediaCardSchema.extend({
  genres: z.array(z.string().min(1)),
  logoImageTag: z.string().min(1).optional(),
  originalTitle: z.string().min(1).optional(),
  overview: z.string().min(1).optional(),
  premiereDate: z.iso.datetime().optional(),
  tagline: z.string().min(1).optional(),
});

export const SeasonSummarySchema = z.object({
  indexNumber: z.number().int().nonnegative().optional(),
  isPlayed: z.boolean(),
  name: z.string().min(1),
  primaryImageTag: z.string().min(1).optional(),
  seasonId: z.string().min(1),
  seriesId: z.string().min(1).optional(),
  serverId: z.string().min(1),
  unplayedEpisodeCount: z.number().int().nonnegative(),
});

export const EpisodeSummarySchema = z.object({
  episodeId: z.string().min(1),
  episodeNumber: z.number().int().nonnegative().optional(),
  isPlayed: z.boolean(),
  name: z.string().min(1),
  overview: z.string().min(1).optional(),
  playbackPositionSeconds: z.number().int().nonnegative(),
  premiereDate: z.iso.datetime().optional(),
  primaryImageTag: z.string().min(1).optional(),
  runtimeSeconds: z.number().int().nonnegative().optional(),
  seasonId: z.string().min(1).optional(),
  seasonNumber: z.number().int().nonnegative().optional(),
  seriesId: z.string().min(1).optional(),
  seriesName: z.string().min(1).optional(),
  serverId: z.string().min(1),
});

export const PersonKindSchema = z.enum([
  "actor",
  "director",
  "writer",
  "producer",
  "composer",
  "guestStar",
  "unknown",
]);

export const PersonSummarySchema = z.object({
  kind: PersonKindSchema,
  name: z.string().min(1),
  personId: z.string().min(1),
  primaryImageTag: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  serverId: z.string().min(1),
});

export type MediaKind = z.infer<typeof MediaKindSchema>;
export type MediaLibraryKind = z.infer<typeof MediaLibraryKindSchema>;
export type MediaLibrary = z.infer<typeof MediaLibrarySchema>;
export type MediaCard = z.infer<typeof MediaCardSchema>;
export type MediaDetail = z.infer<typeof MediaDetailSchema>;
export type SeasonSummary = z.infer<typeof SeasonSummarySchema>;
export type EpisodeSummary = z.infer<typeof EpisodeSummarySchema>;
export type PersonKind = z.infer<typeof PersonKindSchema>;
export type PersonSummary = z.infer<typeof PersonSummarySchema>;
