import type { UserProfile } from "@newemby/contracts";
import { describe, expect, it } from "vitest";

import { ApiError } from "./api.js";
import { authRedirectForError, navigationForUser } from "./auth-routing.js";

function user(isAdministrator: boolean): UserProfile {
  return {
    name: "Alex",
    permissions: {
      canDownload: true,
      canManageServer: isAdministrator,
      isAdministrator,
    },
    serverId: "server-1",
    userId: "user-1",
  };
}

describe("authenticated application navigation", () => {
  it("shows administration only when the user has that capability", () => {
    expect(navigationForUser(user(true)).map((item) => item.href)).toContain(
      "/admin",
    );
    expect(
      navigationForUser(user(false)).map((item) => item.href),
    ).not.toContain("/admin");
  });

  it("routes missing server and session states to their recovery pages", () => {
    expect(
      authRedirectForError(
        new ApiError("SERVER_NOT_SELECTED", "Select a server", "request-1"),
      ),
    ).toBe("/connect");
    expect(
      authRedirectForError(
        new ApiError("UNAUTHENTICATED", "Sign in", "request-2"),
      ),
    ).toBe("/login");
    expect(authRedirectForError(new Error("Network error"))).toBeNull();
  });
});
