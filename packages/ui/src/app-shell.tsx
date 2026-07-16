import { Fragment, type ReactNode } from "react";

import { BrandMark } from "./brand-mark.js";

export interface SideNavigationItem {
  active?: boolean;
  disabled?: boolean;
  href: string;
  icon: ReactNode;
  label: string;
}

export interface NavigationLinkRenderOptions {
  children: ReactNode;
  className: string;
  item: SideNavigationItem;
}

export type NavigationLinkRenderer = (
  options: NavigationLinkRenderOptions,
) => ReactNode;

export interface SideNavigationProps {
  expanded?: boolean;
  items: SideNavigationItem[];
  renderHomeLink?: (children: ReactNode, className: string) => ReactNode;
  renderLink?: NavigationLinkRenderer;
}

export function SideNavigation({
  expanded = false,
  items,
  renderHomeLink,
  renderLink,
}: SideNavigationProps) {
  const homeClassName =
    "flex h-18 items-center gap-3 px-4 text-text no-underline";
  const homeContent = (
    <>
      <BrandMark className="size-10 shrink-0 text-accent" />
      {expanded ? <span className="text-h3 font-semibold">NewEmby</span> : null}
    </>
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-bg/96 lg:flex lg:flex-col ${expanded ? "w-56" : "w-18"}`}
    >
      {renderHomeLink?.(homeContent, homeClassName) ?? (
        <a aria-label="NewEmby 首页" className={homeClassName} href="/">
          {homeContent}
        </a>
      )}

      <nav aria-label="主导航" className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const className = `flex min-h-12 items-center gap-3 rounded-control px-3 text-body no-underline transition-colors duration-120 ${
            item.disabled
              ? "cursor-not-allowed text-text-muted opacity-45"
              : item.active
                ? "bg-accent/18 text-text shadow-[inset_3px_0_0_var(--color-accent)]"
                : "text-text-muted hover:bg-surface-hover hover:text-text"
          }`;
          const children = (
            <>
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center"
              >
                {item.icon}
              </span>
              {expanded ? <span>{item.label}</span> : null}
            </>
          );

          if (item.disabled)
            return (
              <span
                aria-label={expanded ? undefined : item.label}
                aria-disabled="true"
                className={className}
                key={item.href}
                role="link"
                title={`${item.label}（尚未开放）`}
              >
                {children}
              </span>
            );

          return (
            <Fragment key={item.href}>
              {renderLink?.({ children, className, item }) ?? (
                <a
                  aria-label={expanded ? undefined : item.label}
                  aria-current={item.active ? "page" : undefined}
                  className={className}
                  href={item.href}
                  title={expanded ? undefined : item.label}
                >
                  {children}
                </a>
              )}
            </Fragment>
          );
        })}
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
  renderHomeLink?: SideNavigationProps["renderHomeLink"];
  renderNavigationLink?: NavigationLinkRenderer;
  title: string;
}

export function AppShell({
  children,
  expandedNavigation = false,
  headerActions,
  navigation,
  renderHomeLink,
  renderNavigationLink,
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
      <SideNavigation
        expanded={expandedNavigation}
        items={navigation}
        renderHomeLink={renderHomeLink}
        renderLink={renderNavigationLink}
      />
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
