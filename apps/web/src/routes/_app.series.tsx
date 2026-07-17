import { EmptyState } from "@newemby/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { HomeMediaCard } from "../components/home-media.js";
import {
  MediaBrowserGrid,
  MediaBrowserFilters,
  MediaBrowserHeader,
  MediaBrowserLoading,
  MediaBrowserPage,
  MediaBrowserPagination,
} from "../components/media-browser.js";
import { MediaErrorState } from "../components/media-state.js";
import {
  latestMediaBrowserDefaults,
  parseMediaBrowserSearch,
  type MediaBrowserSearch,
} from "../media-browser-search.js";
import { mediaLibrariesQuery, seriesQuery } from "../media-query.js";

const parseSearch = (search: Record<string, unknown>): MediaBrowserSearch => ({
  ...parseMediaBrowserSearch(search, latestMediaBrowserDefaults),
  kind: [],
});

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
  const search = Route.useSearch();
  const { page } = search;
  const navigate = Route.useNavigate();
  const libraries = useQuery(mediaLibrariesQuery);
  const query = useQuery({
    ...seriesQuery(search),
    placeholderData: keepPreviousData,
  });

  if (query.isPending) return <SeriesLoading />;
  if (query.isError)
    return (
      <MediaErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        subject="剧集库"
      />
    );

  const result = query.data;
  const pageCount = Math.max(1, Math.ceil(result.total / result.limit));
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
      <MediaBrowserFilters
        libraries={libraries.data?.libraries ?? []}
        onApply={(next) => void navigate({ search: next })}
        onReset={() => void navigate({ search: parseSearch({}) })}
        search={search}
        showSeriesStatus
      />
      {result.items.length === 0 ? (
        <EmptyState
          description="没有符合当前筛选条件的授权剧集，可以调整或重置筛选。"
          title="没有找到剧集"
        />
      ) : (
        <>
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
            onNext={() =>
              void navigate({ search: { ...search, page: page + 1 } })
            }
            onPrevious={() =>
              void navigate({ search: { ...search, page: page - 1 } })
            }
            page={page}
            pageCount={pageCount}
          />
        </>
      )}
    </MediaBrowserPage>
  );
}

export const Route = createFileRoute("/_app/series")({
  component: SeriesPage,
  validateSearch: parseSearch,
});
