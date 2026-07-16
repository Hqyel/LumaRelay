import {
  Button,
  EmptyState,
  ErrorState,
  PosterCard,
  Skeleton,
} from "@newemby/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { mediaImageUrl } from "../api.js";
import { moviesQuery } from "../media-query.js";

export interface MoviesSearch {
  page: number;
}

function parseSearch(search: Record<string, unknown>): MoviesSearch {
  const candidate = Number(search.page);
  return {
    page: Number.isInteger(candidate) && candidate > 0 ? candidate : 1,
  };
}

function MoviesLoading() {
  return (
    <div
      aria-label="正在加载电影"
      className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
      role="status"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <Skeleton className="aspect-[2/3] rounded-poster" key={index} />
      ))}
    </div>
  );
}

function MoviesPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const query = useQuery({
    ...moviesQuery(page),
    placeholderData: keepPreviousData,
  });

  if (query.isPending) return <MoviesLoading />;
  if (query.isError)
    return (
      <ErrorState
        action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
        description="无法读取电影库，请检查媒体服务器连接后重试。"
        title="电影库暂时不可用"
      />
    );

  const result = query.data;
  const pageCount = Math.max(1, Math.ceil(result.total / result.limit));
  if (result.items.length === 0)
    return (
      <EmptyState
        description="当前账户授权的媒体库中没有电影。"
        title="没有找到电影"
      />
    );

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label font-semibold uppercase tracking-[0.16em] text-accent">
            电影库
          </p>
          <h1 className="mt-2 text-h1 font-semibold">全部电影</h1>
          <p className="mt-2 text-body text-text-muted">
            当前账户可浏览 {result.total} 部电影
          </p>
        </div>
        <p className="text-small text-text-muted">
          第 {page} / {pageCount} 页
        </p>
      </header>

      <section
        aria-label="电影列表"
        className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
      >
        {result.items.map((item) => (
          <PosterCard
            action={
              <Button
                disabled
                size="small"
                title="详情将在 M1-018 开放"
                variant="secondary"
              >
                查看详情
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
            subtitle={item.productionYear?.toString()}
            title={item.title}
          />
        ))}
      </section>

      <nav
        aria-label="电影分页"
        className="flex items-center justify-center gap-3"
      >
        <Button
          disabled={page <= 1 || query.isFetching}
          onClick={() => void navigate({ search: { page: page - 1 } })}
          variant="secondary"
        >
          上一页
        </Button>
        <Button
          disabled={page >= pageCount || query.isFetching}
          onClick={() => void navigate({ search: { page: page + 1 } })}
          variant="secondary"
        >
          下一页
        </Button>
      </nav>
    </div>
  );
}

export const Route = createFileRoute("/_app/movies")({
  component: MoviesPage,
  validateSearch: parseSearch,
});
