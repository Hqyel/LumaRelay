import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/search")({
  beforeLoad: () => {
    throw redirect({ replace: true, to: "/home" });
  },
});
