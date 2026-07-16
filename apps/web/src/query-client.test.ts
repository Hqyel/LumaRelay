import { describe, expect, it } from "vitest";

import { createQueryClient } from "./query-client.js";

describe("Web query client", () => {
  it("uses the documented home-query cache defaults", () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions().queries;

    expect(defaults?.staleTime).toBe(60_000);
    expect(defaults?.retry).toBe(1);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });
});
