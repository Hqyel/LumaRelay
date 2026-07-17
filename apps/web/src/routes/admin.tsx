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
  const metrics = [
    { label: "服务器状态", value: "已连接" },
    { label: "运行时间", value: "—" },
    { label: "媒体项目", value: "—" },
    { label: "在线会话", value: "—" },
  ];

  return (
    <AdminShell
      actions={
        <button
          aria-label="管理帮助（尚未开放）"
          className="grid size-8 cursor-not-allowed place-items-center rounded-control text-text-muted opacity-40"
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
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-80 rounded-full bg-accent/10 blur-[100px]"
        />
        <header className="relative mb-6">
          <p className="text-label font-semibold uppercase tracking-[0.14em] text-accent-hover">
            NewEmby Control Center
          </p>
          <h2 className="mt-1 text-h2 font-semibold text-white">服务器概览</h2>
          <p className="mt-2 max-w-2xl text-small text-text-muted">
            管理能力将按 M4 进度逐项开放；当前页面仅展示安全边界和入口状态。
          </p>
        </header>
        <section className="relative grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value }, index) => (
            <article
              className="group min-h-32 rounded-panel border border-white/10 bg-[#141423]/70 p-5 shadow-[0_4px_20px_rgb(0_0_0_/_30%)] backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_8px_36px_rgb(0_0_0_/_40%)] motion-reduce:transform-none"
              key={label}
            >
              <div className="flex items-center justify-between">
                <p className="text-small text-text-muted">{label}</p>
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${index === 0 ? "bg-success shadow-[0_0_10px_rgb(53_199_138_/_65%)]" : "bg-white/20"}`}
                />
              </div>
              <p className="mt-5 text-h2 font-semibold text-white">{value}</p>
            </article>
          ))}
        </section>
        <section className="relative mt-6 overflow-hidden rounded-panel border border-white/10 bg-[#141423]/70 shadow-[0_4px_20px_rgb(0_0_0_/_30%)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-body font-semibold text-white">管理模块</h2>
            <p className="mt-1 text-small text-text-muted">
              未实现入口保持禁用，不会导航到空白或 404 页面。
            </p>
          </div>
          <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
            {navigation.slice(1, 5).map((item) => (
              <div
                className="flex min-h-20 items-center gap-3 bg-[#141423] px-5 text-text-muted"
                key={item.href}
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 place-items-center rounded-control bg-white/[0.05] text-white/35"
                >
                  {item.icon}
                </span>
                <div>
                  <p className="text-small font-medium text-white/55">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-label text-white/55">尚未开放</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
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
