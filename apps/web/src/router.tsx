import { createRouter } from "@tanstack/react-router";

import { queryClient } from "./runtime.js";
import { routeTree } from "./routeTree.gen.js";

export const router = createRouter({
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 30_000,
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
