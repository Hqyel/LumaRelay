import { describe, expect, it, vi } from "vitest";

import { listPublicUsers, loadPublicUserAvatar } from "./public-users.js";

describe("Emby public users", () => {
  it("maps public users without exposing upstream DTO fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            HasPassword: true,
            Id: "user-1",
            Name: "Alex",
            PrimaryImageTag: "image-tag",
          },
        ]),
        { status: 200 },
      ),
    );

    await expect(
      listPublicUsers("https://emby.example.com", { fetch: fetcher }),
    ).resolves.toEqual([
      {
        avatarUrl: "/api/v1/auth/public-users/user-1/avatar",
        hasPassword: true,
        name: "Alex",
        primaryImageTag: "image-tag",
        userId: "user-1",
      },
    ]);
  });

  it("returns avatar bytes and safe response metadata", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png", etag: "image-tag" },
        status: 200,
      }),
    );

    const avatar = await loadPublicUserAvatar(
      "https://emby.example.com",
      "user-1",
      { fetch: fetcher },
    );

    expect(avatar.contentType).toBe("image/png");
    expect(avatar.body).toEqual(new Uint8Array([1, 2, 3]));
  });
});
