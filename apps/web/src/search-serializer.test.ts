import { describe, expect, it } from "vitest";

import {
  parseRepeatedSearch,
  stringifyRepeatedSearch,
} from "./search-serializer.js";

describe("repeated search serializer", () => {
  it("round-trips arrays as repeated parameters", () => {
    const serialized = stringifyRepeatedSearch({
      genre: ["剧情", "科幻"],
      page: 2,
      year: [2024, 2026],
    });
    const params = new URLSearchParams(serialized);
    expect(params.getAll("genre")).toEqual(["剧情", "科幻"]);
    expect(params.getAll("year")).toEqual(["2024", "2026"]);
    expect(parseRepeatedSearch(serialized)).toEqual({
      genre: ["剧情", "科幻"],
      page: "2",
      year: ["2024", "2026"],
    });
  });
});
