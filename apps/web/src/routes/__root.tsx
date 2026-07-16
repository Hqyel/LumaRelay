import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { subscribeToUnauthorized } from "../api.js";

export interface RouterContext {
  queryClient: QueryClient;
}

function RootLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeToUnauthorized(() => {
        queryClient.clear();
        void navigate({ replace: true, to: "/login" });
      }),
    [navigate, queryClient],
  );

  return <Outlet />;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
