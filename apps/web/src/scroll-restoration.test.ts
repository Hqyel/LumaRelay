import { describe, expect, it } from "vitest";

import { scrollRestorationKey } from "./scroll-restoration.js";

describe("scroll restoration key", () => {
  it("keeps pagination and filter state isolated by canonical URL", () => {
    expect(
      scrollRestorationKey({
        pathname: "/movies",
        searchStr: "?genre=Drama&genre=Sci-Fi&page=2",
      }),
    ).toBe("/movies?genre=Drama&genre=Sci-Fi&page=2");
  });
});
