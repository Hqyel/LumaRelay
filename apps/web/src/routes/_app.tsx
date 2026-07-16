import { AppShell, type SideNavigationItem } from "@newemby/ui";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  Film,
  Heart,
  Home,
  Library,
  ListVideo,
  Search,
  Settings,
  Shield,
  Tv,
} from "lucide-react";

import { useUiStore } from "../stores/ui-store.js";

const navigation: SideNavigationItem[] = [
  { active: true, href: "/", icon: <Home size={20} />, label: "首页" },
  { href: "/movies", icon: <Film size={20} />, label: "电影" },
  { href: "/series", icon: <Tv size={20} />, label: "剧集" },
  { href: "/libraries", icon: <Library size={20} />, label: "媒体库" },
  { href: "/favorites", icon: <Heart size={20} />, label: "收藏" },
  { href: "/playlists", icon: <ListVideo size={20} />, label: "播放列表" },
  { href: "/search", icon: <Search size={20} />, label: "搜索" },
  { href: "/admin", icon: <Shield size={20} />, label: "管理后台" },
  { href: "/settings", icon: <Settings size={20} />, label: "设置" },
];

function HeaderActions() {
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
        aria-label="打开用户菜单"
        className="grid size-9 place-items-center rounded-full bg-surface text-small font-semibold"
        type="button"
      >
        NE
      </button>
    </>
  );
}

function FrontAppLayout() {
  const expandedNavigation = useUiStore((state) => state.navigationExpanded);

  return (
    <AppShell
      expandedNavigation={expandedNavigation}
      headerActions={<HeaderActions />}
      navigation={navigation}
      title="首页"
    >
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_app")({
  component: FrontAppLayout,
});
