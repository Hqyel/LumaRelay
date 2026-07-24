import {
  EmbyBaseItemDtoSchema,
  EmbyEpisodeDtoSchema,
  EmbyMediaDtoSchema,
  EmbyPersonDtoSchema,
  EmbyPublicInfoDtoSchema,
  EmbySeasonDtoSchema,
  EmbyUserDtoSchema,
  toEpisodeSummary,
  toMediaCard,
  toMediaDetail,
  toMediaLibrary,
  toPersonSummary,
  toSeasonSummary,
  toServerSummary,
  toUserProfile,
  ticksToSeconds,
} from "@lumarelay/emby-client";
import { describe, expect, it } from "vitest";

describe("public package entry", () => {
  it("exports all completed DTO schemas and adapters", () => {
    expect([
      EmbyPublicInfoDtoSchema,
      EmbyUserDtoSchema,
      EmbyBaseItemDtoSchema,
      EmbyMediaDtoSchema,
      EmbySeasonDtoSchema,
      EmbyEpisodeDtoSchema,
      EmbyPersonDtoSchema,
    ]).toHaveLength(7);
    const adapters = [
      toServerSummary,
      toUserProfile,
      toMediaLibrary,
      toMediaCard,
      toMediaDetail,
      toSeasonSummary,
      toEpisodeSummary,
      toPersonSummary,
    ];
    for (const adapter of adapters) expect(adapter).toBeTypeOf("function");
    expect(ticksToSeconds(10_000_000)).toBe(1);
  });
});
