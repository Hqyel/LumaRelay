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

export function SideNavigation({ items, renderLink }: SideNavigationProps) {
  return (
    <nav
      aria-label="主导航"
      className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const className =
          "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-small " +
          "font-medium no-underline transition-[color,background,transform] duration-150 " +
          (item.disabled
            ? "cursor-not-allowed text-text-muted opacity-35"
            : item.active
              ? "bg-[linear-gradient(135deg,#7C5CFF_0%,#764BA2_100%)] text-white shadow-[0_2px_8px_rgb(0_0_0_/_20%),0_0_20px_rgb(124_92_255_/_30%)]"
              : "text-text-muted hover:bg-accent/10 hover:text-text active:scale-95");
        const children = (
          <>
            <span
              aria-hidden="true"
              className="grid size-4 place-items-center [&_svg]:size-4"
            >
              {item.icon}
            </span>
            <span className="hidden xl:inline">{item.label}</span>
          </>
        );

        if (item.disabled)
          return (
            <span
              aria-disabled="true"
              aria-label={item.label}
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
                aria-current={item.active ? "page" : undefined}
                aria-label={item.label}
                className={className}
                href={item.href}
                title={item.label}
              >
                {children}
              </a>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export interface ContextHeaderProps {
  actions?: ReactNode;
  expandedNavigation?: boolean;
  title: string;
}

export function ContextHeader({ actions, title }: ContextHeaderProps) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </>
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
  headerActions,
  navigation,
  renderHomeLink,
  renderNavigationLink,
  title,
}: AppShellProps) {
  const brandClassName =
    "flex h-9 shrink-0 items-center gap-1 rounded-control px-2 text-text " +
    "no-underline transition-colors duration-150 hover:bg-accent/10";
  const brand = (
    <>
      <BrandMark className="size-6 text-accent drop-shadow-[0_0_8px_rgb(124_92_255_/_42%)]" />
      <span className="hidden bg-[linear-gradient(135deg,#7C5CFF_0%,#A995FF_100%)] bg-clip-text text-small font-bold text-transparent sm:inline">
        NewEmby
      </span>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0f0f23] text-text">
      <a
        className="fixed left-4 top-1 z-[60] -translate-y-16 rounded-control bg-[#6848dc] px-4 py-2 font-semibold text-white transition-transform focus:translate-y-0"
        href="#main-content"
      >
        跳到主要内容
      </a>
      <header className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between gap-3 border-b border-white/10 bg-[#141423]/80 px-3 shadow-[0_2px_8px_rgb(0_0_0_/_20%)] backdrop-blur-xl sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {renderHomeLink?.(brand, brandClassName) ?? (
            <a aria-label="NewEmby 首页" className={brandClassName} href="/">
              {brand}
            </a>
          )}
          <SideNavigation
            items={navigation}
            renderLink={renderNavigationLink}
          />
        </div>
        <ContextHeader actions={headerActions} title={title} />
      </header>
      <main className="min-h-screen pt-12" id="main-content">
        {children}
      </main>
    </div>
  );
}
