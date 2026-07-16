import type { UserProfile } from "@newemby/contracts";
import { AppShell, type NavigationLinkRenderOptions } from "@newemby/ui";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { logout } from "../api.js";
import { authRedirectForError, navigationForUser } from "../auth-routing.js";
import { sessionQuery } from "../session-query.js";
import { useUiStore } from "../stores/ui-store.js";

function renderHomeLink(children: ReactNode, className: string) {
  return (
    <Link aria-label="NewEmby 首页" className={className} to="/home">
      {children}
    </Link>
  );
}

function renderNavigationLink({
  children,
  className,
  item,
}: NavigationLinkRenderOptions) {
  if (item.href === "/admin")
    return (
      <Link
        aria-current={item.active ? "page" : undefined}
        aria-label={item.label}
        className={className}
        to="/admin"
      >
        {children}
      </Link>
    );

  if (item.href === "/home")
    return (
      <Link
        aria-current={item.active ? "page" : undefined}
        aria-label={item.label}
        className={className}
        to="/home"
      >
        {children}
      </Link>
    );

  if (item.href === "/movies")
    return (
      <Link
        aria-current={item.active ? "page" : undefined}
        aria-label={item.label}
        className={className}
        search={{ page: 1 }}
        to="/movies"
      >
        {children}
      </Link>
    );

  if (item.href === "/series")
    return (
      <Link
        aria-current={item.active ? "page" : undefined}
        aria-label={item.label}
        className={className}
        search={{ page: 1 }}
        to="/series"
      >
        {children}
      </Link>
    );

  return <span className={className}>{children}</span>;
}

function HeaderActions({ user }: { user: UserProfile }) {
  const initials = user.name.slice(0, 2).toUpperCase();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: logout,
    async onSuccess() {
      queryClient.clear();
      await navigate({ replace: true, to: "/login" });
    },
  });

  return (
    <>
      <button
        aria-label="全局搜索（尚未开放）"
        className="grid size-10 cursor-not-allowed place-items-center rounded-control text-text-muted opacity-45"
        disabled
        title="全局搜索（尚未开放）"
        type="button"
      >
        <Search aria-hidden="true" size={20} />
      </button>
      <span className="hidden items-center gap-2 text-small text-text-muted sm:flex">
        <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
        Bridge 未连接
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            aria-label={`打开 ${user.name} 的用户菜单`}
            className="grid size-9 place-items-center rounded-full bg-surface text-small font-semibold hover:bg-surface-hover"
            title={user.name}
            type="button"
          >
            {initials}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="z-50 min-w-44 rounded-control border border-border bg-surface p-2 shadow-panel"
            sideOffset={8}
          >
            <DropdownMenu.Label className="px-3 py-2 text-small text-text-muted">
              {user.name}
            </DropdownMenu.Label>
            <DropdownMenu.Item
              className="cursor-pointer rounded-control px-3 py-2 text-body outline-none hover:bg-surface-hover focus:bg-surface-hover data-disabled:cursor-not-allowed data-disabled:opacity-50"
              disabled={logoutMutation.isPending}
              onSelect={() => logoutMutation.mutate()}
            >
              {logoutMutation.isPending ? "正在退出…" : "退出登录"}
            </DropdownMenu.Item>
            {logoutMutation.isError ? (
              <p
                aria-live="polite"
                className="px-3 py-2 text-small text-danger"
                role="alert"
              >
                退出失败，请重试。
              </p>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}

function FrontAppLayout() {
  const expandedNavigation = useUiStore((state) => state.navigationExpanded);
  const { data: session } = useQuery(sessionQuery);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (session === undefined) return null;
  const title =
    pathname === "/movies" ? "电影" : pathname === "/series" ? "剧集" : "首页";

  return (
    <AppShell
      expandedNavigation={expandedNavigation}
      headerActions={<HeaderActions user={session.user} />}
      navigation={navigationForUser(session.user, pathname)}
      renderHomeLink={renderHomeLink}
      renderNavigationLink={renderNavigationLink}
      title={title}
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
