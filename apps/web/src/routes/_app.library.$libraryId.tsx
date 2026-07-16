import {
  Button,
  EmptyState,
  ErrorState,
  PosterCard,
  Skeleton,
} from "@newemby/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { mediaImageUrl } from "../api.js";
import { libraryItemsQuery, mediaLibrariesQuery } from "../media-query.js";

export interface LibrarySearch {
  page: number;
}

function parseSearch(search: Record<string, unknown>): LibrarySearch {
  const candidate = Number(search.page);
  return {
    page: Number.isInteger(candidate) && candidate > 0 ? candidate : 1,
  };
}

function Loading() {
  return (
    <div
      aria-label="正在加载媒体库条目"
      className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
      role="status"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <Skeleton className="aspect-[2/3] rounded-poster" key={index} />
      ))}
    </div>
  );
}

function LibraryPage() {
  const { libraryId } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const libraries = useQuery(mediaLibrariesQuery);
  const authorized = libraries.data?.libraries.some(
    (library) => library.libraryId === libraryId,
  );
  const items = useQuery({
    ...libraryItemsQuery(libraryId, page),
    enabled: authorized === true,
    placeholderData: keepPreviousData,
  });

  if (libraries.isPending || (authorized === true && items.isPending))
    return <Loading />;
  if (libraries.isError)
    return (
      <ErrorState
        action={
          <Button onClick={() => void libraries.refetch()}>重新加载</Button>
        }
        description="无法验证当前账户的媒体库权限。"
        title="媒体库暂时不可用"
      />
    );

  const library = libraries.data?.libraries.find(
    (candidate) => candidate.libraryId === libraryId,
  );
  if (library === undefined)
    return (
      <ErrorState
        description="这个媒体库不在当前账户的授权视图中。"
        title="无权访问媒体库"
      />
    );
  if (items.isError || items.data === undefined)
    return (
      <ErrorState
        action={<Button onClick={() => void items.refetch()}>重新加载</Button>}
        description="无法读取这个媒体库，请稍后重试。"
        title="媒体库暂时不可用"
      />
    );
  if (items.data.items.length === 0)
    return (
      <EmptyState
        description="这个媒体库中没有可供当前账户浏览的媒体。"
        title="媒体库为空"
      />
    );

  const pageCount = Math.max(1, Math.ceil(items.data.total / items.data.limit));
  return (
    <div className="space-y-8 pb-12">
      <header>
        <p className="text-label font-semibold uppercase tracking-[0.16em] text-accent">
          媒体库
        </p>
        <h1 className="mt-2 text-h1 font-semibold">{library.name}</h1>
        <p className="mt-2 text-body text-text-muted">
          {items.data.total} 个可浏览条目 · 第 {page} / {pageCount} 页
        </p>
      </header>
      <section
        aria-label={`${library.name} 条目`}
        className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
      >
        {items.data.items.map((item) => (
          <PosterCard
            action={
              <Button asChild size="small" variant="secondary">
                <Link params={{ id: item.itemId }} to="/item/$id">
                  查看详情
                </Link>
              </Button>
            }
            favorite={item.isFavorite}
            imageUrl={mediaImageUrl({
              imageType: "primary",
              itemId: item.itemId,
              preset: "poster",
              tag: item.primaryImageTag,
            })}
            key={item.itemId}
            progress={item.playedPercentage}
            subtitle={item.productionYear?.toString() ?? item.subtitle}
            title={item.title}
            unwatchedCount={item.unplayedItemCount}
          />
        ))}
      </section>
      <nav aria-label="媒体库分页" className="flex justify-center gap-3">
        <Button
          disabled={page <= 1 || items.isFetching}
          onClick={() => void navigate({ search: { page: page - 1 } })}
          variant="secondary"
        >
          上一页
        </Button>
        <Button
          disabled={page >= pageCount || items.isFetching}
          onClick={() => void navigate({ search: { page: page + 1 } })}
          variant="secondary"
        >
          下一页
        </Button>
      </nav>
    </div>
  );
}

export const Route = createFileRoute("/_app/library/$libraryId")({
  component: LibraryPage,
  validateSearch: parseSearch,
});
