import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { assertFixtureIsSafe, sanitizeFixture } from "./fixture-safety.js";

function readFixture(name: string): unknown {
  const url = new URL(`../fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

describe("Emby fixture safety", () => {
  it.each(["public-info.json", "ping.json"])(
    "contains no sensitive data: %s",
    (name) => {
      expect(() => assertFixtureIsSafe(readFixture(name))).not.toThrow();
    },
  );

  it("redacts sensitive keys and media paths", () => {
    expect(
      sanitizeFixture({
        AccessToken: "secret-token",
        title: "Fixture",
        mediaLocation: "/media/movies/example.mkv",
      }),
    ).toEqual({
      AccessToken: "[REDACTED]",
      title: "Fixture",
      mediaLocation: "[REDACTED]",
    });
  });

  it("fails closed when an unsafe fixture is supplied", () => {
    expect(() => assertFixtureIsSafe({ username: "real-user" })).toThrowError(
      "Fixture contains a sensitive key or value",
    );
  });
});
