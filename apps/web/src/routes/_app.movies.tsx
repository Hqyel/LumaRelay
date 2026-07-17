import { EmptyState } from "@newemby/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  MediaBrowserFilters,
  MediaBrowserHeader,
  MediaBrowserLoading,
  MediaBrowserPage,
  MediaBrowserPagination,
} from "../components/media-browser.js";
import { MediaErrorState } from "../components/media-state.js";
import { VirtualMediaBrowserGrid } from "../components/virtual-media-grid.js";
import {
  latestMediaBrowserDefaults,
  parseMediaBrowserSearch,
  type MediaBrowserSearch,
} from "../media-browser-search.js";
import { mediaLibrariesQuery, moviesQuery } from "../media-query.js";

const parseSearch = (search: Record<string, unknown>): MediaBrowserSearch => ({
  ...parseMediaBrowserSearch(search, latestMediaBrowserDefaults),
  kind: [],
  seriesStatus: "any",
});

function MoviesLoading() {
  return <MediaBrowserLoading label="正在加载电影" />;
}

function MoviesPage() {
  const search = Route.useSearch();
  const { page } = search;
  const navigate = Route.useNavigate();
  const libraries = useQuery(mediaLibrariesQuery);
  const query = useQuery({
    ...moviesQuery(search),
    placeholderData: keepPreviousData,
  });

  if (query.isPending) return <MoviesLoading />;
  if (query.isError)
    return (
      <MediaErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        subject="电影库"
      />
    );

  const result = query.data;
  const pageCount = Math.max(1, Math.ceil(result.total / result.limit));
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
      <MediaBrowserFilters
        libraries={libraries.data?.libraries ?? []}
        onApply={(next) => void navigate({ search: next })}
        onReset={() => void navigate({ search: parseSearch({}) })}
        search={search}
      />
      {result.items.length === 0 ? (
        <EmptyState
          description="没有符合当前筛选条件的授权电影，可以调整或重置筛选。"
          title="没有找到电影"
        />
      ) : (
        <>
          <VirtualMediaBrowserGrid items={result.items} label="电影列表" />
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

export const Route = createFileRoute("/_app/movies")({
  component: MoviesPage,
  loaderDeps: ({ search }) => parseSearch(search),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.prefetchQuery(mediaLibrariesQuery),
      context.queryClient.prefetchQuery(moviesQuery(deps)),
    ]);
  },
  validateSearch: parseSearch,
});
