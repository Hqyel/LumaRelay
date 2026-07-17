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
