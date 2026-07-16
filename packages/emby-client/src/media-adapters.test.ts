import {
  MediaCardSchema,
  MediaDetailSchema,
  MediaLibrarySchema,
} from "@newemby/contracts";
import { describe, expect, it } from "vitest";

import {
  EmbyBaseItemDtoSchema,
  ticksToSeconds,
  toMediaCard,
  toMediaDetail,
  toMediaLibrary,
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
});
