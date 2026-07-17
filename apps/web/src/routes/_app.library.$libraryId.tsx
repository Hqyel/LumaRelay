import { EmptyState } from "@newemby/ui";
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
import {
  MediaAccessDeniedState,
  MediaErrorState,
} from "../components/media-state.js";
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
  return <MediaBrowserLoading label="正在加载媒体库条目" />;
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
  if (items.data.items.length === 0)
    return (
      <EmptyState
        description="这个媒体库中没有可供当前账户浏览的媒体。"
        title="媒体库为空"
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
      <MediaBrowserGrid label={`${library.name} 条目`}>
        {items.data.items.map((item) => (
          <HomeMediaCard item={item} key={item.itemId} />
        ))}
      </MediaBrowserGrid>
      <MediaBrowserPagination
        busy={items.isFetching}
        onNext={() => void navigate({ search: { page: page + 1 } })}
        onPrevious={() => void navigate({ search: { page: page - 1 } })}
        page={page}
        pageCount={pageCount}
      />
    </MediaBrowserPage>
  );
}

export const Route = createFileRoute("/_app/library/$libraryId")({
  component: LibraryPage,
  validateSearch: parseSearch,
});
