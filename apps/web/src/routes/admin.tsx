import {
  AdminShell,
  type NavigationLinkRenderOptions,
  type SideNavigationItem,
} from "@newemby/ui";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  Boxes,
  Gauge,
  KeyRound,
  Library,
  ListChecks,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { adminRedirectForUser, authRedirectForError } from "../auth-routing.js";
import { sessionQuery } from "../session-query.js";

const navigation: SideNavigationItem[] = [
  { active: true, href: "/admin", icon: <Gauge size={19} />, label: "概览" },
  {
    disabled: true,
    href: "/admin/sessions",
    icon: <Activity size={19} />,
    label: "活动会话",
  },
  {
    disabled: true,
    href: "/admin/users",
    icon: <Users size={19} />,
    label: "用户",
  },
  {
    disabled: true,
    href: "/admin/libraries",
    icon: <Library size={19} />,
    label: "媒体库",
  },
  {
    disabled: true,
    href: "/admin/tasks",
    icon: <ListChecks size={19} />,
    label: "计划任务",
  },
  {
    disabled: true,
    href: "/admin/plugins",
    icon: <Boxes size={19} />,
    label: "插件",
  },
  {
    disabled: true,
    href: "/admin/access",
    icon: <KeyRound size={19} />,
    label: "设备与密钥",
  },
  {
    disabled: true,
    href: "/admin/logs",
    icon: <ScrollText size={19} />,
    label: "日志",
  },
  {
    disabled: true,
    href: "/admin/settings",
    icon: <Settings size={19} />,
    label: "服务器设置",
  },
];

function renderHomeLink(children: ReactNode, className: string) {
  return (
    <Link aria-label="NewEmby 管理概览" className={className} to="/admin">
      {children}
    </Link>
  );
}

function renderNavigationLink({
  children,
  className,
  item,
}: NavigationLinkRenderOptions) {
  return (
    <Link
      aria-current={item.active ? "page" : undefined}
      className={className}
      to="/admin"
    >
      {children}
    </Link>
  );
}

function AdminFoundationPage() {
  return (
    <AdminShell
      actions={
        <button
          aria-label="管理帮助（尚未开放）"
          className="grid size-10 cursor-not-allowed place-items-center rounded-control text-text-muted opacity-45"
          disabled
          title="管理帮助（尚未开放）"
          type="button"
        >
          <BookOpen aria-hidden="true" size={19} />
        </button>
      }
      breadcrumbs={["管理后台", "概览"]}
      navigation={navigation}
      renderHomeLink={renderHomeLink}
      renderNavigationLink={renderNavigationLink}
      title="概览"
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["服务器状态", "运行时间", "媒体项目", "在线会话"].map((label) => (
          <article
            className="min-h-32 rounded-panel border border-border bg-surface p-5 shadow-card"
            key={label}
          >
            <p className="text-small text-text-muted">{label}</p>
            <p className="mt-5 text-h2 font-semibold">—</p>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    try {
      const session = await context.queryClient.ensureQueryData(sessionQuery);
      const target = adminRedirectForUser(session.user);
      if (target !== null) throw redirect({ to: target });
    } catch (error) {
      const target = authRedirectForError(error);
      if (target !== null) throw redirect({ to: target });
      throw error;
    }
  },
  component: AdminFoundationPage,
});
