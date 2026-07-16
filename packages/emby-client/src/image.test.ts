import { describe, expect, it } from "vitest";

import { buildEmbyImageUrl, resolveImageSize } from "./image.js";

describe("Emby image strategy", () => {
  it("keeps homepage posters within the 360-480 pixel budget", () => {
    expect(resolveImageSize("poster", 180, 2)).toEqual({
      maxHeight: 540,
      maxWidth: 360,
    });
    expect(resolveImageSize("poster", 320, 3).maxWidth).toBe(480);
  });

  it("caps detail backdrops according to device pixel ratio", () => {
    expect(resolveImageSize("backdrop", 2400, 1).maxWidth).toBe(1920);
    expect(resolveImageSize("backdrop", 1600, 2).maxWidth).toBe(2560);
  });

  it("builds a subpath-safe URL with immutable image tag and dimensions", () => {
    const url = buildEmbyImageUrl("https://emby.example.com/emby", {
      imageTag: "image-tag-v2",
      imageType: "Backdrop",
      index: 0,
      itemId: "item/1",
      size: resolveImageSize("backdrop", 1280, 2),
    });

    expect(url.pathname).toBe("/emby/Items/item%2F1/Images/Backdrop/0");
    expect(url.searchParams.get("tag")).toBe("image-tag-v2");
    expect(url.searchParams.get("maxWidth")).toBe("2560");
    expect(url.searchParams.has("api_key")).toBe(false);
    expect(url.searchParams.has("access_token")).toBe(false);
  });

  it("changes the cache key when the Emby Image Tag changes", () => {
    const request = {
      imageTag: "tag-1",
      imageType: "Primary" as const,
      itemId: "item-1",
      size: resolveImageSize("poster", 200, 2),
    };
    const first = buildEmbyImageUrl("https://emby.example.com", request);
    const second = buildEmbyImageUrl("https://emby.example.com", {
      ...request,
      imageTag: "tag-2",
    });

    expect(first.toString()).not.toBe(second.toString());
  });

  it("rejects invalid sizing inputs", () => {
    expect(() => resolveImageSize("poster", 0, 1)).toThrow(TypeError);
    expect(() =>
      buildEmbyImageUrl("https://emby.example.com", {
        imageTag: "tag-1",
        imageType: "Primary",
        itemId: "item-1",
        size: { maxWidth: Number.NaN },
      }),
    ).toThrow(TypeError);
  });
});
