import { createRouter } from "@tanstack/react-router";

import { queryClient } from "./runtime.js";
import { routeTree } from "./routeTree.gen.js";
import {
  parseRepeatedSearch,
  stringifyRepeatedSearch,
} from "./search-serializer.js";

export const router = createRouter({
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 30_000,
  parseSearch: parseRepeatedSearch,
  routeTree,
  stringifySearch: stringifyRepeatedSearch,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
