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
import { seriesQuery } from "../media-query.js";

export interface SeriesSearch {
  page: number;
}

function parseSearch(search: Record<string, unknown>): SeriesSearch {
  const candidate = Number(search.page);
  return {
    page: Number.isInteger(candidate) && candidate > 0 ? candidate : 1,
  };
}

function formatLatest(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return `更新于 ${new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value))}`;
}

function SeriesLoading() {
  return <MediaBrowserLoading label="正在加载剧集" />;
}

function seriesSubtitle(
  status: "continuing" | "ended" | undefined,
  latest: string | undefined,
): string | undefined {
  const values = [
    status === undefined
      ? undefined
      : status === "continuing"
        ? "连载中"
        : "已完结",
    formatLatest(latest),
  ].filter((value): value is string => value !== undefined);
  return values.length === 0 ? undefined : values.join(" · ");
}

function SeriesPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const query = useQuery({
    ...seriesQuery(page),
    placeholderData: keepPreviousData,
  });

  if (query.isPending) return <SeriesLoading />;
  if (query.isError)
    return (
      <ErrorState
        action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
        description="无法读取剧集库，请检查媒体服务器连接后重试。"
        title="剧集库暂时不可用"
      />
    );

  const result = query.data;
  const pageCount = Math.max(1, Math.ceil(result.total / result.limit));
  if (result.items.length === 0)
    return (
      <EmptyState
        description="当前账户授权的媒体库中没有剧集。"
        title="没有找到剧集"
      />
    );

  return (
    <MediaBrowserPage>
      <MediaBrowserHeader
        eyebrow="剧集库"
        page={page}
        pageCount={pageCount}
        title="全部剧集"
        total={result.total}
        unit="部"
      />
      <MediaBrowserGrid label="剧集列表">
        {result.items.map((item) => (
          <HomeMediaCard
            item={item}
            key={item.itemId}
            secondaryText={seriesSubtitle(
              item.seriesStatus,
              item.latestEpisodeDate,
            )}
          />
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

export const Route = createFileRoute("/_app/series")({
  component: SeriesPage,
  validateSearch: parseSearch,
});
