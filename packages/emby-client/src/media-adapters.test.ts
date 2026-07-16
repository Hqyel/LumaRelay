import {
  MediaCardSchema,
  MediaDetailSchema,
  MediaLibrarySchema,
  EpisodeSummarySchema,
  PersonSummarySchema,
  SeasonSummarySchema,
} from "@newemby/contracts";
import { describe, expect, it } from "vitest";

import {
  EmbyBaseItemDtoSchema,
  ticksToSeconds,
  toEpisodeSummary,
  toMediaCard,
  toMediaDetail,
  toMediaLibrary,
  toPersonSummary,
  toSeasonSummary,
} from "./media-adapters.js";

describe("Emby media domain adapters", () => {
  it("maps an authorized view to MediaLibrary", () => {
    const dto = EmbyBaseItemDtoSchema.parse({
      ChildCount: 42,
      CollectionType: "movies",
      Id: "library-1",
      ImageTags: { Primary: "library-image" },
      Name: "Movies",
      Type: "CollectionFolder",
    });
    const library = toMediaLibrary(dto, "server-1");

    expect(library).toEqual({
      itemCount: 42,
      kind: "movies",
      libraryId: "library-1",
      name: "Movies",
      primaryImageTag: "library-image",
      serverId: "server-1",
    });
    expect(MediaLibrarySchema.safeParse(library).success).toBe(true);
  });

  it("maps card metadata and user playback state", () => {
    const dto = EmbyBaseItemDtoSchema.parse({
      BackdropImageTags: ["backdrop-image"],
      CommunityRating: 8.2,
      Id: "movie-1",
      ImageTags: { Primary: "poster-image" },
      Name: "Fixture Movie",
      OfficialRating: "PG-13",
      ProductionYear: 2025,
      RunTimeTicks: 7_200_000_000,
      Type: "Movie",
      UserData: {
        IsFavorite: true,
        Played: false,
        PlayedPercentage: 25.5,
        PlaybackPositionTicks: 1_800_000_000,
      },
    });
    const card = toMediaCard(dto, "server-1");

    expect(card).toMatchObject({
      isFavorite: true,
      itemId: "movie-1",
      kind: "movie",
      playbackPositionSeconds: 180,
      runtimeSeconds: 720,
      title: "Fixture Movie",
    });
    expect(MediaCardSchema.safeParse(card).success).toBe(true);
  });

  it("maps detail copy and strips Emby-only fields", () => {
    const dto = EmbyBaseItemDtoSchema.parse({
      Genres: ["Drama", " Mystery "],
      Id: "movie-1",
      ImageTags: { Logo: "logo-image", Primary: "poster-image" },
      MediaSources: [{ Path: "/private/movie.mkv" }],
      Name: "Fixture Movie",
      OriginalTitle: "Fixture Original",
      Overview: "A fixture overview.",
      PremiereDate: "2025-01-02T00:00:00.000Z",
      Taglines: ["", "A fixture tagline"],
      Type: "Movie",
    });
    const detail = toMediaDetail(dto, "server-1");

    expect(detail).toMatchObject({
      genres: ["Drama", "Mystery"],
      logoImageTag: "logo-image",
      originalTitle: "Fixture Original",
      overview: "A fixture overview.",
      tagline: "A fixture tagline",
    });
    expect(detail).not.toHaveProperty("MediaSources");
    expect(MediaDetailSchema.safeParse(detail).success).toBe(true);
  });

  it("uses stable defaults for missing user data and unknown types", () => {
    const dto = EmbyBaseItemDtoSchema.parse({
      Id: "item-1",
      Name: "Unknown Item",
      Type: "ChannelVideo",
    });

    expect(toMediaCard(dto, "server-1")).toMatchObject({
      isFavorite: false,
      isPlayed: false,
      kind: "unknown",
      playbackPositionSeconds: 0,
    });
    expect(ticksToSeconds(undefined)).toBeUndefined();
  });

  it("maps series lifecycle and latest episode date", () => {
    const card = toMediaCard(
      EmbyBaseItemDtoSchema.parse({
        DateLastMediaAdded: "2026-07-15T10:00:00.000Z",
        Id: "series-1",
        Name: "Fixture Series",
        Status: "Continuing",
        Type: "Series",
        UserData: { UnplayedItemCount: 4 },
      }),
      "server-1",
    );

    expect(card).toMatchObject({
      latestEpisodeDate: "2026-07-15T10:00:00.000Z",
      seriesStatus: "continuing",
      unplayedItemCount: 4,
    });
  });

  it("maps season state and unplayed episode count", () => {
    const dto = EmbyBaseItemDtoSchema.parse({
      Id: "season-1",
      ImageTags: { Primary: "season-poster" },
      IndexNumber: 1,
      Name: "Season 1",
      SeriesId: "series-1",
      Type: "Season",
      UserData: { Played: false, UnplayedItemCount: 3 },
    });
    const season = toSeasonSummary(dto, "server-1");

    expect(season).toMatchObject({
      indexNumber: 1,
      seasonId: "season-1",
      seriesId: "series-1",
      unplayedEpisodeCount: 3,
    });
    expect(SeasonSummarySchema.safeParse(season).success).toBe(true);
  });

  it("maps episode numbering, duration, and playback position", () => {
    const dto = EmbyBaseItemDtoSchema.parse({
      Id: "episode-1",
      IndexNumber: 4,
      Name: "Fixture Episode",
      Overview: "Episode overview.",
      ParentIndexNumber: 2,
      PlaybackPositionTicks: 1_000_000_000,
      RunTimeTicks: 3_600_000_000,
      SeasonId: "season-2",
      SeriesId: "series-1",
      SeriesName: "Fixture Series",
      Type: "Episode",
      UserData: {
        Played: false,
        PlaybackPositionTicks: 1_000_000_000,
      },
    });
    const episode = toEpisodeSummary(dto, "server-1");

    expect(episode).toMatchObject({
      episodeNumber: 4,
      playbackPositionSeconds: 100,
      runtimeSeconds: 360,
      seasonNumber: 2,
      seriesName: "Fixture Series",
    });
    expect(EpisodeSummarySchema.safeParse(episode).success).toBe(true);
  });

  it("maps person role and primary image tag", () => {
    const dto = EmbyBaseItemDtoSchema.parse({
      Id: "person-1",
      Name: "Fixture Actor",
      PrimaryImageTag: "person-image",
      Role: "Lead",
      Type: "Actor",
    });
    const person = toPersonSummary(dto, "server-1");

    expect(person).toEqual({
      kind: "actor",
      name: "Fixture Actor",
      personId: "person-1",
      primaryImageTag: "person-image",
      role: "Lead",
      serverId: "server-1",
    });
    expect(PersonSummarySchema.safeParse(person).success).toBe(true);
  });
});
