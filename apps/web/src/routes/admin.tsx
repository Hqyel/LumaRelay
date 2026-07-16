import { AdminShell, type SideNavigationItem } from "@newemby/ui";
import { createFileRoute } from "@tanstack/react-router";
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

const navigation: SideNavigationItem[] = [
  { active: true, href: "/admin", icon: <Gauge size={19} />, label: "概览" },
  {
    href: "/admin/sessions",
    icon: <Activity size={19} />,
    label: "活动会话",
  },
  { href: "/admin/users", icon: <Users size={19} />, label: "用户" },
  { href: "/admin/libraries", icon: <Library size={19} />, label: "媒体库" },
  { href: "/admin/tasks", icon: <ListChecks size={19} />, label: "计划任务" },
  { href: "/admin/plugins", icon: <Boxes size={19} />, label: "插件" },
  { href: "/admin/access", icon: <KeyRound size={19} />, label: "设备与密钥" },
  { href: "/admin/logs", icon: <ScrollText size={19} />, label: "日志" },
  {
    href: "/admin/settings",
    icon: <Settings size={19} />,
    label: "服务器设置",
  },
];

function AdminFoundationPage() {
  return (
    <AdminShell
      actions={
        <button
          aria-label="打开管理帮助"
          className="grid size-10 place-items-center rounded-control text-text-muted hover:bg-surface-hover hover:text-text"
          type="button"
        >
          <BookOpen aria-hidden="true" size={19} />
        </button>
      }
      breadcrumbs={["管理后台", "概览"]}
      navigation={navigation}
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
  component: AdminFoundationPage,
});
