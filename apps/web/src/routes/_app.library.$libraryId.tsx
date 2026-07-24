import { EmptyState } from "@lumarelay/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  MediaBrowserFilters,
  MediaBrowserHeader,
  MediaBrowserLoading,
  MediaBrowserPage,
  MediaBrowserPagination,
} from "../components/media-browser.js";
import {
  MediaAccessDeniedState,
  MediaErrorState,
} from "../components/media-state.js";
import { VirtualMediaBrowserGrid } from "../components/virtual-media-grid.js";
import {
  libraryMediaBrowserDefaults,
  parseMediaBrowserSearch,
  type MediaBrowserSearch,
} from "../media-browser-search.js";
import { libraryItemsQuery, mediaLibrariesQuery } from "../media-query.js";

const parseSearch = (search: Record<string, unknown>): MediaBrowserSearch =>
  parseMediaBrowserSearch(search, libraryMediaBrowserDefaults);

function Loading() {
  return <MediaBrowserLoading label="正在加载媒体库条目" />;
}

function LibraryPage() {
  const { libraryId } = Route.useParams();
  const search = Route.useSearch();
  const { page } = search;
  const navigate = Route.useNavigate();
  const libraries = useQuery(mediaLibrariesQuery);
  const authorized = libraries.data?.libraries.some(
    (library) => library.libraryId === libraryId,
  );
  const items = useQuery({
    ...libraryItemsQuery(libraryId, search),
    enabled: authorized === true,
    placeholderData: keepPreviousData,
  });

  if (libraries.isPending || (authorized === true && items.isPending))
    return <Loading />;
  if (libraries.isError)
    return (
      <MediaErrorState
        error={libraries.error}
        onRetry={() => void libraries.refetch()}
        subject="媒体库权限"
      />
    );

  const library = libraries.data?.libraries.find(
    (candidate) => candidate.libraryId === libraryId,
  );
  if (library === undefined) return <MediaAccessDeniedState subject="媒体库" />;
  if (items.isError || items.data === undefined)
    return (
      <MediaErrorState
        error={items.error}
        onRetry={() => void items.refetch()}
        subject={library.name}
      />
    );
  const pageCount = Math.max(1, Math.ceil(items.data.total / items.data.limit));
  return (
    <MediaBrowserPage>
      <MediaBrowserHeader
        eyebrow="媒体库"
        page={page}
        pageCount={pageCount}
        title={library.name}
        total={items.data.total}
        unit="项"
      />
      <MediaBrowserFilters
        onApply={(next) => void navigate({ search: next })}
        onReset={() => void navigate({ search: parseSearch({}) })}
        search={search}
        showKinds
        showSeriesStatus
      />
      {items.data.items.length === 0 ? (
        <EmptyState
          description="没有符合当前筛选条件的授权媒体，可以调整或重置筛选。"
          title="媒体库为空"
        />
      ) : (
        <>
          <VirtualMediaBrowserGrid
            items={items.data.items}
            label={`${library.name} 条目`}
          />
          <MediaBrowserPagination
            busy={items.isFetching}
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

export const Route = createFileRoute("/_app/library/$libraryId")({
  component: LibraryPage,
  loaderDeps: ({ search }) => parseSearch(search),
  loader: async ({ context, deps, params }) => {
    const libraries = await context.queryClient
      .fetchQuery(mediaLibrariesQuery)
      .catch(() => undefined);
    if (
      libraries !== undefined &&
      libraries.libraries.some(
        (library) => library.libraryId === params.libraryId,
      )
    )
      await context.queryClient.prefetchQuery(
        libraryItemsQuery(params.libraryId, deps),
      );
  },
  validateSearch: parseSearch,
});
