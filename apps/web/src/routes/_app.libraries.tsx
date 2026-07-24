import { EmptyState } from "@lumarelay/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  LibraryBrowserCard,
  MediaBrowserHeader,
  MediaBrowserPage,
} from "../components/media-browser.js";
import { MediaErrorState } from "../components/media-state.js";
import { mediaLibrariesQuery } from "../media-query.js";

function LibrariesPage() {
  const query = useQuery(mediaLibrariesQuery);

  if (query.isPending)
    return (
      <div
        aria-label="正在加载媒体库"
        className="media-browser-page media-library-list-loading"
        role="status"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span className="media-library-row-skeleton" key={index} />
        ))}
      </div>
    );
  if (query.isError)
    return (
      <MediaErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        subject="媒体库"
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
    <MediaBrowserPage>
      <MediaBrowserHeader
        eyebrow="授权视图"
        title="媒体库"
        total={query.data.libraries.length}
        unit="个"
      />
      <section aria-label="媒体库列表" className="media-library-list">
        {query.data.libraries.map((library) => (
          <LibraryBrowserCard key={library.libraryId} library={library} />
        ))}
      </section>
    </MediaBrowserPage>
  );
}

export const Route = createFileRoute("/_app/libraries")({
  component: LibrariesPage,
});
