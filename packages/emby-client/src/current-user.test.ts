import { describe, expect, it, vi } from "vitest";

import { getAuthenticatedUser } from "./current-user.js";

const input = {
  accessToken: "emby-secret-token",
  deviceId: "gateway-device-id",
  serverId: "server-1",
  userId: "user-1",
};

describe("authenticated Emby user", () => {
  it("maps refreshed permissions and sends the token only upstream", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Id: "user-1",
          Name: "Alex",
          Policy: {
            EnableContentDownloading: true,
            IsAdministrator: true,
          },
          PrimaryImageTag: "image-tag",
        }),
      ),
    );

    const user = await getAuthenticatedUser("https://emby.example.com", input, {
      fetch: fetcher,
    });

    expect(user.permissions.isAdministrator).toBe(true);
    expect(user.serverId).toBe("server-1");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://emby.example.com/Users/user-1"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-emby-token": "emby-secret-token",
        }),
      }),
    );
  });

  it.each([401, 404])(
    "classifies an expired or missing upstream user (%s)",
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }));

      await expect(
        getAuthenticatedUser("https://emby.example.com", input, {
          fetch: fetcher,
        }),
      ).rejects.toMatchObject({ kind: "unauthorized" });
    },
  );
});
