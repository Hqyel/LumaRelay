import { describe, expect, it, vi } from "vitest";

import { logoutEmbySession } from "./logout.js";

describe("Emby session logout", () => {
  it("sends the access token only to the Emby logout endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await logoutEmbySession(
      "https://emby.example.com",
      { accessToken: "emby-secret-token", deviceId: "gateway-device-id" },
      { fetch: fetcher },
    );

    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://emby.example.com/Sessions/Logout"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-emby-token": "emby-secret-token",
        }),
        method: "POST",
      }),
    );
  });

  it("treats an already invalid upstream token as logged out", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));

    await expect(
      logoutEmbySession(
        "https://emby.example.com",
        { accessToken: "expired-token", deviceId: "gateway-device-id" },
        { fetch: fetcher },
      ),
    ).resolves.toBeUndefined();
  });
});
