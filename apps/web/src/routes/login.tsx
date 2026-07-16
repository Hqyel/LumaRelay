import { BrandMark } from "@newemby/ui";
import { createFileRoute } from "@tanstack/react-router";

function LoginPlaceholder() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg p-6 text-text">
      <section className="w-full max-w-lg rounded-panel border border-border bg-surface p-10 text-center shadow-panel">
        <BrandMark className="mx-auto mb-5 size-12 text-accent" />
        <h1 className="text-h2 font-semibold">服务器已连接</h1>
        <p className="mt-3 text-body text-text-muted">
          登录界面将在下一项任务中启用。
        </p>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPlaceholder,
});
