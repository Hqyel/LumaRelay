import {
  Button,
  EmptyState,
  ErrorState,
  PosterCard,
  Skeleton,
} from "@newemby/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { mediaImageUrl } from "../api.js";
import { mediaLibrariesQuery } from "../media-query.js";

function LibrariesPage() {
  const query = useQuery(mediaLibrariesQuery);

  if (query.isPending)
    return (
      <div
        aria-label="正在加载媒体库"
        className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5"
        role="status"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="aspect-[2/3] rounded-poster" key={index} />
        ))}
      </div>
    );
  if (query.isError)
    return (
      <ErrorState
        action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
        description="无法读取当前账户的媒体库。"
        title="媒体库暂时不可用"
      />
    );
  if (query.data.libraries.length === 0)
    return (
      <EmptyState
        description="Emby 尚未向当前账户授权任何媒体库。"
        title="没有可用媒体库"
      />
    );

  return (
    <div className="space-y-8 pb-12">
      <header>
        <p className="text-label font-semibold uppercase tracking-[0.16em] text-accent">
          授权视图
        </p>
        <h1 className="mt-2 text-h1 font-semibold">媒体库</h1>
        <p className="mt-2 text-body text-text-muted">
          这里只显示当前 Emby 用户有权访问的媒体库。
        </p>
      </header>
      <section
        aria-label="媒体库列表"
        className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
      >
        {query.data.libraries.map((library) => (
          <PosterCard
            action={
              <Button asChild size="small" variant="secondary">
                <Link
                  params={{ libraryId: library.libraryId }}
                  search={{ page: 1 }}
                  to="/library/$libraryId"
                >
                  打开媒体库
                </Link>
              </Button>
            }
            imageUrl={mediaImageUrl({
              imageType: "primary",
              itemId: library.libraryId,
              preset: "poster",
              tag: library.primaryImageTag,
            })}
            key={library.libraryId}
            subtitle={
              library.itemCount === undefined
                ? undefined
                : `${library.itemCount} 个条目`
            }
            title={library.name}
          />
        ))}
      </section>
    </div>
  );
}

export const Route = createFileRoute("/_app/libraries")({
  component: LibrariesPage,
});
