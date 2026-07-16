import type { ReactNode } from "react";

import { BrandMark } from "./brand-mark.js";
import type { SideNavigationItem } from "./app-shell.js";

export interface AdminShellProps {
  actions?: ReactNode;
  breadcrumbs?: string[];
  children: ReactNode;
  navigation: SideNavigationItem[];
  title: string;
}

export function AdminShell({
  actions,
  breadcrumbs = [],
  children,
  navigation,
  title,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <a
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-control bg-accent px-4 py-2 text-on-accent transition-transform focus:translate-y-0"
        href="#admin-main-content"
      >
        跳到管理内容
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-bg-elevated lg:flex lg:flex-col">
        <a
          aria-label="NewEmby 管理概览"
          className="flex h-18 items-center gap-3 px-6 text-text no-underline"
          href="/admin"
        >
          <BrandMark className="size-9 text-accent" />
          <span className="text-h3 font-semibold">NewEmby</span>
        </a>
        <span className="px-6 pb-3 text-label font-semibold text-accent">
          管理后台
        </span>
        <nav aria-label="管理导航" className="flex flex-1 flex-col gap-1 px-3">
          {navigation.map((item) => (
            <a
              aria-current={item.active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-body no-underline transition-colors ${
                item.active
                  ? "bg-accent/18 text-text"
                  : "text-text-muted hover:bg-surface-hover hover:text-text"
              }`}
              href={item.href}
              key={item.href}
            >
              <span
                aria-hidden="true"
                className="grid size-6 place-items-center"
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-bg/92 px-4 backdrop-blur-xl sm:px-6 lg:left-60 lg:px-10">
        <div>
          {breadcrumbs.length > 0 ? (
            <p className="mb-0.5 text-label text-text-muted">
              {breadcrumbs.join(" / ")}
            </p>
          ) : null}
          <h1 className="text-h3 font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-3">{actions}</div>
      </header>

      <main className="min-h-screen pt-16 lg:pl-60" id="admin-main-content">
        <div className="mx-auto w-full max-w-[90rem] p-4 sm:p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
