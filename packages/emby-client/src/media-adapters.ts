import {
  MediaCardSchema,
  MediaDetailSchema,
  MediaLibrarySchema,
  EpisodeSummarySchema,
  PersonSummarySchema,
  SeasonSummarySchema,
  type EpisodeSummary,
  type MediaCard,
  type MediaDetail,
  type MediaKind,
  type MediaLibrary,
  type MediaLibraryKind,
  type PersonKind,
  type PersonSummary,
  type SeasonSummary,
} from "@newemby/contracts";
import { z } from "zod";

export const EmbyUserDataDtoSchema = z.object({
  IsFavorite: z.boolean().optional(),
  Played: z.boolean().optional(),
  PlayedPercentage: z.number().nullish(),
  PlaybackPositionTicks: z.number().int().nonnegative().optional(),
  UnplayedItemCount: z.number().int().nonnegative().nullish(),
});

export const EmbyPersonInlineDtoSchema = z.object({
  Id: z.string().min(1),
  Name: z.string().min(1),
  PrimaryImageTag: z.string().nullish(),
  Role: z.string().nullish(),
  Type: z.string().min(1),
});

export const EmbyBaseItemDtoSchema = z.object({
  BackdropImageTags: z.array(z.string()).nullish(),
  ChildCount: z.number().int().nonnegative().nullish(),
  CollectionType: z.string().nullish(),
  CommunityRating: z.number().nonnegative().nullish(),
  DateLastMediaAdded: z.string().nullish(),
  Genres: z.array(z.string()).nullish(),
  Id: z.string().min(1),
  ImageTags: z.record(z.string(), z.string()).nullish(),
  Name: z.string().min(1),
  IndexNumber: z.number().int().nonnegative().nullish(),
  OfficialRating: z.string().nullish(),
  OriginalTitle: z.string().nullish(),
  Overview: z.string().nullish(),
  ParentId: z.string().nullish(),
  ParentIndexNumber: z.number().int().nonnegative().nullish(),
  People: z.array(EmbyPersonInlineDtoSchema).nullish(),
  PremiereDate: z.string().nullish(),
  ProductionYear: z.number().int().nonnegative().nullish(),
  PrimaryImageTag: z.string().nullish(),
  Role: z.string().nullish(),
  RunTimeTicks: z.number().int().nonnegative().nullish(),
  SeriesName: z.string().nullish(),
  SeriesId: z.string().nullish(),
  SeasonId: z.string().nullish(),
  Status: z.string().nullish(),
  Taglines: z.array(z.string()).nullish(),
  Type: z.string().min(1),
  UserData: EmbyUserDataDtoSchema.nullish(),
});

export type EmbyBaseItemDto = z.infer<typeof EmbyBaseItemDtoSchema>;
export const EmbyMediaDtoSchema = EmbyBaseItemDtoSchema;
export const EmbySeasonDtoSchema = EmbyBaseItemDtoSchema;
export const EmbyEpisodeDtoSchema = EmbyBaseItemDtoSchema;
export const EmbyPersonDtoSchema = EmbyBaseItemDtoSchema;
export type EmbyMediaDto = EmbyBaseItemDto;
export type EmbySeasonDto = EmbyBaseItemDto;
export type EmbyEpisodeDto = EmbyBaseItemDto;
export type EmbyPersonDto = EmbyBaseItemDto;

export function ticksToSeconds(
  ticks: number | null | undefined,
): number | undefined {
  if (ticks === undefined || ticks === null) return undefined;
  return Math.floor(ticks / 10_000_000);
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === "" ? undefined : normalized;
}

function mediaKind(type: string): MediaKind {
  switch (type.toLowerCase()) {
    case "movie":
      return "movie";
    case "series":
      return "series";
    case "episode":
      return "episode";
    case "video":
      return "video";
    case "boxset":
      return "boxSet";
    case "playlist":
      return "playlist";
    default:
      return "unknown";
  }
}

function libraryKind(type: string | null | undefined): MediaLibraryKind {
  switch (type?.toLowerCase()) {
    case "movies":
      return "movies";
    case "tvshows":
      return "series";
    case "mixed":
      return "mixed";
    case "music":
      return "music";
    case "photos":
      return "photos";
    case "books":
      return "books";
    default:
      return "unknown";
  }
}

function personKind(type: string): PersonKind {
  switch (type.toLowerCase()) {
    case "actor":
      return "actor";
    case "director":
      return "director";
    case "writer":
      return "writer";
    case "producer":
      return "producer";
    case "composer":
      return "composer";
    case "gueststar":
      return "guestStar";
    default:
      return "unknown";
  }
}

function percentage(value: number | null | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  return Math.min(100, Math.max(0, value));
}

function seriesStatus(
  value: string | null | undefined,
): "continuing" | "ended" | undefined {
  if (value?.toLowerCase() === "continuing") return "continuing";
  if (value?.toLowerCase() === "ended") return "ended";
  return undefined;
}

function cardInput(dto: EmbyBaseItemDto, serverId: string) {
  return {
    backdropImageTag: nonEmpty(dto.BackdropImageTags?.[0]),
    communityRating: dto.CommunityRating ?? undefined,
    isFavorite: dto.UserData?.IsFavorite === true,
    isPlayed: dto.UserData?.Played === true,
    itemId: dto.Id,
    kind: mediaKind(dto.Type),
    latestEpisodeDate: nonEmpty(dto.DateLastMediaAdded),
    officialRating: nonEmpty(dto.OfficialRating),
    parentId: nonEmpty(dto.ParentId),
    playbackPositionSeconds:
      ticksToSeconds(dto.UserData?.PlaybackPositionTicks) ?? 0,
    playedPercentage: percentage(dto.UserData?.PlayedPercentage),
    primaryImageTag: nonEmpty(dto.ImageTags?.Primary),
    productionYear: dto.ProductionYear ?? undefined,
    runtimeSeconds: ticksToSeconds(dto.RunTimeTicks),
    serverId,
    seriesStatus: seriesStatus(dto.Status),
    subtitle: nonEmpty(dto.SeriesName),
    title: dto.Name,
    unplayedItemCount: dto.UserData?.UnplayedItemCount ?? undefined,
  };
}

export function toMediaLibrary(
  dto: EmbyBaseItemDto,
  serverId: string,
): MediaLibrary {
  return MediaLibrarySchema.parse({
    itemCount: dto.ChildCount ?? undefined,
    kind: libraryKind(dto.CollectionType),
    libraryId: dto.Id,
    name: dto.Name,
    primaryImageTag: nonEmpty(dto.ImageTags?.Primary),
    serverId,
  });
}

export function toMediaCard(dto: EmbyBaseItemDto, serverId: string): MediaCard {
  return MediaCardSchema.parse(cardInput(dto, serverId));
}

export function toMediaDetail(
  dto: EmbyBaseItemDto,
  serverId: string,
): MediaDetail {
  return MediaDetailSchema.parse({
    ...cardInput(dto, serverId),
    genres: (dto.Genres ?? []).map((genre) => genre.trim()).filter(Boolean),
    logoImageTag: nonEmpty(dto.ImageTags?.Logo),
    originalTitle: nonEmpty(dto.OriginalTitle),
    overview: nonEmpty(dto.Overview),
    premiereDate: nonEmpty(dto.PremiereDate),
    tagline: nonEmpty(dto.Taglines?.find((tagline) => tagline.trim() !== "")),
  });
}

export function toSeasonSummary(
  dto: EmbyBaseItemDto,
  serverId: string,
): SeasonSummary {
  return SeasonSummarySchema.parse({
    indexNumber: dto.IndexNumber ?? undefined,
    isPlayed: dto.UserData?.Played === true,
    name: dto.Name,
    primaryImageTag: nonEmpty(dto.ImageTags?.Primary),
    seasonId: dto.Id,
    seriesId: nonEmpty(dto.SeriesId),
    serverId,
    unplayedEpisodeCount: dto.UserData?.UnplayedItemCount ?? 0,
  });
}

export function toEpisodeSummary(
  dto: EmbyBaseItemDto,
  serverId: string,
): EpisodeSummary {
  return EpisodeSummarySchema.parse({
    episodeId: dto.Id,
    episodeNumber: dto.IndexNumber ?? undefined,
    isPlayed: dto.UserData?.Played === true,
    name: dto.Name,
    overview: nonEmpty(dto.Overview),
    playbackPositionSeconds:
      ticksToSeconds(dto.UserData?.PlaybackPositionTicks) ?? 0,
    premiereDate: nonEmpty(dto.PremiereDate),
    primaryImageTag: nonEmpty(dto.ImageTags?.Primary),
    runtimeSeconds: ticksToSeconds(dto.RunTimeTicks),
    seasonId: nonEmpty(dto.SeasonId),
    seasonNumber: dto.ParentIndexNumber ?? undefined,
    seriesId: nonEmpty(dto.SeriesId),
    seriesName: nonEmpty(dto.SeriesName),
    serverId,
  });
}

export function toPersonSummary(
  dto: EmbyBaseItemDto,
  serverId: string,
): PersonSummary {
  return PersonSummarySchema.parse({
    kind: personKind(dto.Type),
    name: dto.Name,
    personId: dto.Id,
    primaryImageTag:
      nonEmpty(dto.PrimaryImageTag) ?? nonEmpty(dto.ImageTags?.Primary),
    role: nonEmpty(dto.Role),
    serverId,
  });
}
