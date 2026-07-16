import type { UserProfile } from "@newemby/contracts";
import type { SideNavigationItem } from "@newemby/ui";
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

import { ApiError } from "./api.js";

export function authRedirectForError(
  error: unknown,
): "/connect" | "/login" | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "SERVER_NOT_SELECTED") return "/connect";
  if (error.code === "UNAUTHENTICATED") return "/login";
  return null;
}

export function navigationForUser(user: UserProfile): SideNavigationItem[] {
  const items: SideNavigationItem[] = [
    { active: true, href: "/", icon: <Home size={20} />, label: "首页" },
    {
      disabled: true,
      href: "/movies",
      icon: <Film size={20} />,
      label: "电影",
    },
    { disabled: true, href: "/series", icon: <Tv size={20} />, label: "剧集" },
    {
      disabled: true,
      href: "/libraries",
      icon: <Library size={20} />,
      label: "媒体库",
    },
    {
      disabled: true,
      href: "/favorites",
      icon: <Heart size={20} />,
      label: "收藏",
    },
    {
      disabled: true,
      href: "/playlists",
      icon: <ListVideo size={20} />,
      label: "播放列表",
    },
    {
      disabled: true,
      href: "/search",
      icon: <Search size={20} />,
      label: "搜索",
    },
  ];

  if (user.permissions.isAdministrator)
    items.push({
      href: "/admin",
      icon: <Shield size={20} />,
      label: "管理后台",
    });

  items.push({
    disabled: true,
    href: "/settings",
    icon: <Settings size={20} />,
    label: "设置",
  });
  return items;
}

export function adminRedirectForUser(user: UserProfile): "/" | null {
  return user.permissions.isAdministrator ? null : "/";
}
