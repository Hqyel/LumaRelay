import { Fragment, type ReactNode } from "react";

import { BrandMark } from "./brand-mark.js";
import type {
  NavigationLinkRenderer,
  SideNavigationItem,
} from "./app-shell.js";

export interface AdminShellProps {
  actions?: ReactNode;
  breadcrumbs?: string[];
  children: ReactNode;
  navigation: SideNavigationItem[];
  renderHomeLink?: (children: ReactNode, className: string) => ReactNode;
  renderNavigationLink?: NavigationLinkRenderer;
  title: string;
}

export function AdminShell({
  actions,
  breadcrumbs = [],
  children,
  navigation,
  renderHomeLink,
  renderNavigationLink,
  title,
}: AdminShellProps) {
  const homeClassName =
    "flex h-12 items-center gap-2 border-b border-border px-4 text-text no-underline " +
    "transition-colors duration-150 hover:bg-accent/10";
  const homeContent = (
    <>
      <BrandMark className="size-6 text-accent drop-shadow-[0_0_8px_rgb(124_92_255_/_42%)]" />
      <span className="bg-[linear-gradient(135deg,#7C5CFF,#A995FF)] bg-clip-text text-small font-bold text-transparent">
        NewEmby
      </span>
    </>
  );

  return (
    <div className="min-h-screen bg-bg text-text">
      <a
        className="fixed left-4 top-1 z-50 -translate-y-16 rounded-control bg-[#6848dc] px-4 py-2 font-semibold text-on-accent transition-transform focus:translate-y-0"
        href="#admin-main-content"
      >
        跳到管理内容
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-border bg-glass shadow-[4px_0_24px_rgb(var(--theme-shadow-rgb)_/_16%)] backdrop-blur-xl lg:flex lg:flex-col">
        {renderHomeLink?.(homeContent, homeClassName) ?? (
          <a
            aria-label="NewEmby 管理概览"
            className={homeClassName}
            href="/admin"
          >
            {homeContent}
          </a>
        )}
        <span className="px-4 pb-2 pt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
          管理后台
        </span>
        <nav
          aria-label="管理导航"
          className="flex flex-1 flex-col gap-1 px-2.5"
        >
          {navigation.map((item) => {
            const className = `flex min-h-10 items-center gap-2.5 rounded-control px-3 text-small font-medium no-underline transition-[background,color,box-shadow,transform] duration-150 ${
              item.disabled
                ? "cursor-not-allowed text-text-subtle"
                : item.active
                  ? "bg-[linear-gradient(135deg,#7C5CFF_0%,#764BA2_100%)] text-on-accent shadow-[0_2px_8px_rgb(0_0_0_/_20%),0_0_18px_rgb(124_92_255_/_22%)]"
                  : "text-text-muted hover:bg-accent/10 hover:text-text active:scale-[0.98]"
            }`;
            const children = (
              <>
                <span
                  aria-hidden="true"
                  className="grid size-6 place-items-center"
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </>
            );

            if (item.disabled)
              return (
                <span
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
                {renderNavigationLink?.({ children, className, item }) ?? (
                  <a
                    aria-current={item.active ? "page" : undefined}
                    className={className}
                    href={item.href}
                  >
                    {children}
                  </a>
                )}
              </Fragment>
            );
          })}
        </nav>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-glass px-4 shadow-[0_2px_8px_rgb(var(--theme-shadow-rgb)_/_16%)] backdrop-blur-xl sm:px-6 lg:left-56 lg:px-8">
        <div>
          {breadcrumbs.length > 0 ? (
            <p className="text-[0.6875rem] text-text-muted">
              {breadcrumbs.join(" / ")}
            </p>
          ) : null}
          <h1 className="text-small font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-3">{actions}</div>
      </header>

      <main className="min-h-screen pt-12 lg:pl-56" id="admin-main-content">
        <div className="mx-auto w-full max-w-[90rem] p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
