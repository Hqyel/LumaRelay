import { BrandMark } from "@newemby/ui";
import type { ReactNode } from "react";

import { ThemeToggle } from "./theme-toggle.js";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div aria-hidden="true" className="auth-background">
        <span className="auth-orb auth-orb-one" />
        <span className="auth-orb auth-orb-two" />
        <span className="auth-orb auth-orb-three" />
      </div>
      <section className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">
            <BrandMark className="size-11 text-white" />
          </span>
          <span className="auth-logo-text">NewEmby</span>
        </div>
        {children}
        <p className="auth-footer">NewEmby · 安全连接你的 Emby</p>
      </section>
    </main>
  );
}
