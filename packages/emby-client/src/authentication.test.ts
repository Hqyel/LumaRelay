import { describe, expect, it, vi } from "vitest";

import type { EmbyAuthError } from "./auth-errors.js";
import { authenticateUser } from "./authentication.js";

describe("Emby user authentication", () => {
  it("maps a successful response while retaining the token server-side", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          AccessToken: "emby-secret-token",
          ServerId: "server-1",
          User: {
            Id: "user-1",
            Name: "Alex",
            Policy: {
              EnableContentDownloading: true,
              IsAdministrator: true,
            },
            PrimaryImageTag: "image-tag",
          },
        }),
        { status: 200 },
      ),
    );

    const result = await authenticateUser(
      "https://emby.example.com",
      {
        deviceId: "device-1",
        password: "correct-password",
        username: "Alex",
      },
      { fetch: fetcher },
    );

    expect(result.accessToken).toBe("emby-secret-token");
    expect(result.user.permissions.isAdministrator).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://emby.example.com/Users/AuthenticateByName"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("classifies invalid credentials", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));

    await expect(
      authenticateUser(
        "https://emby.example.com",
        { deviceId: "device-1", password: "wrong", username: "Alex" },
        { fetch: fetcher },
      ),
    ).rejects.toMatchObject({
      kind: "unauthorized",
    } satisfies Partial<EmbyAuthError>);
  });
});
