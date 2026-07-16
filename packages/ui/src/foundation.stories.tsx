import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, Inbox, Play } from "lucide-react";

import { Button } from "./button.js";
import { ContinueWatchingCard, PosterCard } from "./media-card.js";
import { EmptyState, ErrorState, Skeleton } from "./states.js";
import { Input } from "./input.js";

function FoundationGallery() {
  return (
    <div className="min-h-screen bg-bg p-8 text-text">
      <div className="mx-auto grid max-w-6xl gap-10">
        <section>
          <h2 className="mb-4 text-h3 font-semibold">Normal and disabled</h2>
          <div className="flex flex-wrap gap-3 rounded-panel border border-border bg-surface p-5">
            <Button>
              <Play aria-hidden="true" fill="currentColor" size={16} />
              Continue
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Input
            hint="Use an HTTPS origin"
            label="Server address"
            value="https://emby.example.com"
            readOnly
          />
          <Input
            error="Server is unreachable"
            label="Server address error"
            value="https://offline.example.com"
            readOnly
          />
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-semibold">Loading</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <Skeleton className="aspect-[2/3]" />
            <div className="space-y-3 sm:col-span-3">
              <Skeleton className="h-8 w-2/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <EmptyState
            action={<Button variant="secondary">Explore movies</Button>}
            description="No media matches the current filters."
            icon={<Inbox size={22} />}
            title="Nothing here yet"
          />
          <ErrorState
            action={<Button variant="secondary">Try again</Button>}
            description="Check the Gateway and Emby server connection."
            icon={<AlertTriangle size={22} />}
            title="Connection failed"
          />
        </section>

        <section className="grid gap-5 sm:grid-cols-[14rem_1fr]">
          <PosterCard
            favorite
            progress={42}
            subtitle="2025 · Science fiction"
            title="Interstellar Return"
            unwatchedCount={2}
          />
          <ContinueWatchingCard
            progress={58}
            remaining="52 minutes"
            title="Quiet Frontier"
          />
        </section>
      </div>
    </div>
  );
}

const meta = {
  component: FoundationGallery,
  parameters: {
    layout: "fullscreen",
  },
  title: "Foundation/Gallery",
} satisfies Meta<typeof FoundationGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllStates: Story = {};
