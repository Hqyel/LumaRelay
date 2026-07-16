import type { ReactNode } from "react";

import { BrandMark } from "./brand-mark.js";

export interface SideNavigationItem {
  active?: boolean;
  href: string;
  icon: ReactNode;
  label: string;
}

export interface SideNavigationProps {
  expanded?: boolean;
  items: SideNavigationItem[];
}

export function SideNavigation({
  expanded = false,
  items,
}: SideNavigationProps) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-bg/96 lg:flex lg:flex-col ${expanded ? "w-56" : "w-18"}`}
    >
      <a
        className="flex h-18 items-center gap-3 px-4 text-text no-underline"
        href="/"
        aria-label="NewEmby 首页"
      >
        <BrandMark className="size-10 shrink-0 text-accent" />
        {expanded ? (
          <span className="text-h3 font-semibold">NewEmby</span>
        ) : null}
      </a>

      <nav aria-label="主导航" className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => (
          <a
            aria-current={item.active ? "page" : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-control px-3 text-body no-underline transition-colors duration-120 ${
              item.active
                ? "bg-accent/18 text-text shadow-[inset_3px_0_0_var(--color-accent)]"
                : "text-text-muted hover:bg-surface-hover hover:text-text"
            }`}
            href={item.href}
            key={item.href}
            title={expanded ? undefined : item.label}
          >
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center"
            >
              {item.icon}
            </span>
            {expanded ? <span>{item.label}</span> : null}
          </a>
        ))}
      </nav>
    </aside>
  );
}

export interface ContextHeaderProps {
  actions?: ReactNode;
  expandedNavigation?: boolean;
  title: string;
}

export function ContextHeader({
  actions,
  expandedNavigation = false,
  title,
}: ContextHeaderProps) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-bg/86 px-4 backdrop-blur-xl sm:px-6 lg:px-10 ${
        expandedNavigation ? "lg:left-56" : "lg:left-18"
      }`}
    >
      <h1 className="text-h3 font-semibold text-text">{title}</h1>
      <div className="flex items-center gap-3">{actions}</div>
    </header>
  );
}

export interface AppShellProps {
  children: ReactNode;
  expandedNavigation?: boolean;
  headerActions?: ReactNode;
  navigation: SideNavigationItem[];
  title: string;
}

export function AppShell({
  children,
  expandedNavigation = false,
  headerActions,
  navigation,
  title,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <a
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-control bg-accent px-4 py-2 text-on-accent transition-transform focus:translate-y-0"
        href="#main-content"
      >
        跳到主要内容
      </a>
      <SideNavigation expanded={expandedNavigation} items={navigation} />
      <ContextHeader
        actions={headerActions}
        expandedNavigation={expandedNavigation}
        title={title}
      />
      <main
        className={`min-h-screen pt-16 transition-[padding] ${
          expandedNavigation ? "lg:pl-56" : "lg:pl-18"
        }`}
        id="main-content"
      >
        {children}
      </main>
    </div>
  );
}
