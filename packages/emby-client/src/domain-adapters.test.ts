import { ServerSummarySchema, UserProfileSchema } from "@lumarelay/contracts";
import { describe, expect, it } from "vitest";

import {
  EmbyPublicInfoDtoSchema,
  EmbyUserDtoSchema,
  toServerSummary,
  toUserProfile,
} from "./domain-adapters.js";

describe("Emby domain adapters", () => {
  it("maps public information to a normalized ServerSummary", () => {
    const dto = EmbyPublicInfoDtoSchema.parse({
      Id: "server-1",
      OperatingSystem: "Windows",
      ServerName: "Home Emby",
      Version: "4.8.11.0",
    });
    const summary = toServerSummary(dto, {
      baseUrl: "https://emby.example.com/emby",
      capabilityFlags: { ping: true, publicInfo: true },
      latencyMs: 12.6,
    });

    expect(summary).toEqual({
      baseUrl: "https://emby.example.com/emby/",
      capabilityFlags: { ping: true, publicInfo: true },
      latencyMs: 13,
      name: "Home Emby",
      serverId: "server-1",
      supportsHttps: true,
      version: "4.8.11.0",
    });
    expect(ServerSummarySchema.safeParse(summary).success).toBe(true);
    expect(summary).not.toHaveProperty("OperatingSystem");
  });

  it("maps administrator policy to explicit UserProfile capabilities", () => {
    const dto = EmbyUserDtoSchema.parse({
      Id: "user-1",
      Name: "Alex",
      Policy: {
        EnableContentDownloading: true,
        IsAdministrator: true,
      },
      PrimaryImageTag: "image-tag",
    });
    const profile = toUserProfile(dto, "server-1");

    expect(profile).toEqual({
      name: "Alex",
      permissions: {
        canDownload: true,
        canManageServer: true,
        isAdministrator: true,
      },
      primaryImageTag: "image-tag",
      serverId: "server-1",
      userId: "user-1",
    });
    expect(UserProfileSchema.safeParse(profile).success).toBe(true);
  });

  it.each([undefined, null])(
    "defaults missing user policy capabilities to false (%s)",
    (policy) => {
      const dto = EmbyUserDtoSchema.parse({
        Id: "user-2",
        Name: "Guest",
        Policy: policy,
        PrimaryImageTag: null,
      });

      expect(toUserProfile(dto, "server-1")).toEqual({
        name: "Guest",
        permissions: {
          canDownload: false,
          canManageServer: false,
          isAdministrator: false,
        },
        serverId: "server-1",
        userId: "user-2",
      });
    },
  );
});
