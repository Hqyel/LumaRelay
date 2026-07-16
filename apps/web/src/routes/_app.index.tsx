import { createFileRoute } from "@tanstack/react-router";
import { BrandMark } from "@newemby/ui";

function FoundationPage() {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center p-6 sm:p-10">
      <section className="w-full max-w-xl rounded-panel border border-border bg-surface p-10 shadow-panel">
        <BrandMark className="mb-6 size-14 text-accent" title="NewEmby" />
        <h2 className="text-h1 font-semibold text-text">NewEmby</h2>
        <p className="mt-3 text-body text-text-muted">
          M0 application shell is running.
        </p>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/_app/")({
  component: FoundationPage,
});
