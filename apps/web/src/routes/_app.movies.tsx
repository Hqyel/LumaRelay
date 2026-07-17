import { Button, EmptyState, ErrorState } from "@newemby/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { HomeMediaCard } from "../components/home-media.js";
import {
  MediaBrowserGrid,
  MediaBrowserHeader,
  MediaBrowserLoading,
  MediaBrowserPage,
  MediaBrowserPagination,
} from "../components/media-browser.js";
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
  return <MediaBrowserLoading label="正在加载电影" />;
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
    <MediaBrowserPage>
      <MediaBrowserHeader
        eyebrow="电影库"
        page={page}
        pageCount={pageCount}
        title="全部电影"
        total={result.total}
        unit="部"
      />
      <MediaBrowserGrid label="电影列表">
        {result.items.map((item) => (
          <HomeMediaCard item={item} key={item.itemId} />
        ))}
      </MediaBrowserGrid>
      <MediaBrowserPagination
        busy={query.isFetching}
        onNext={() => void navigate({ search: { page: page + 1 } })}
        onPrevious={() => void navigate({ search: { page: page - 1 } })}
        page={page}
        pageCount={pageCount}
      />
    </MediaBrowserPage>
  );
}

export const Route = createFileRoute("/_app/movies")({
  component: MoviesPage,
  validateSearch: parseSearch,
});
