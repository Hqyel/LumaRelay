import type { UserProfile } from "@newemby/contracts";
import { AppShell } from "@newemby/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { getCurrentUser } from "../api.js";
import { authRedirectForError, navigationForUser } from "../auth-routing.js";
import { useUiStore } from "../stores/ui-store.js";

const sessionQuery = {
  queryFn: getCurrentUser,
  queryKey: ["auth", "me"],
  retry: false,
  staleTime: 30_000,
} as const;

function HeaderActions({ user }: { user: UserProfile }) {
  const initials = user.name.slice(0, 2).toUpperCase();

  return (
    <>
      <button
        aria-label="打开全局搜索"
        className="grid size-10 place-items-center rounded-control text-text-muted hover:bg-surface-hover hover:text-text"
        type="button"
      >
        <Search aria-hidden="true" size={20} />
      </button>
      <span className="hidden items-center gap-2 text-small text-text-muted sm:flex">
        <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
        Bridge 未连接
      </span>
      <button
        aria-label={`打开 ${user.name} 的用户菜单`}
        className="grid size-9 place-items-center rounded-full bg-surface text-small font-semibold"
        title={user.name}
        type="button"
      >
        {initials}
      </button>
    </>
  );
}

function FrontAppLayout() {
  const expandedNavigation = useUiStore((state) => state.navigationExpanded);
  const { data: session } = useQuery(sessionQuery);

  if (session === undefined) return null;

  return (
    <AppShell
      expandedNavigation={expandedNavigation}
      headerActions={<HeaderActions user={session.user} />}
      navigation={navigationForUser(session.user)}
      title="首页"
    >
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(sessionQuery);
    } catch (error) {
      const target = authRedirectForError(error);
      if (target !== null) throw redirect({ to: target });
      throw error;
    }
  },
  component: FrontAppLayout,
});
