import type { MediaCard } from "@newemby/contracts";
import { EmptyState, Skeleton } from "@newemby/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Film,
  FolderOpen,
  Heart,
  PlayCircle,
  Sparkles,
  Tv,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  HomeLibraryCard,
  HomeMediaCard,
  HomeScroller,
} from "../components/home-media.js";
import { MediaErrorState } from "../components/media-state.js";
import {
  latestMediaBrowserDefaults,
  parseMediaBrowserSearch,
} from "../media-browser-search.js";
import { mediaHomeQuery, mediaLibrariesQuery } from "../media-query.js";

function MoreLink({ children, to }: { children: ReactNode; to: string }) {
  if (to === "/movies")
    return (
      <Link
        className="home-more-link"
        search={parseMediaBrowserSearch({}, latestMediaBrowserDefaults)}
        to="/movies"
      >
        {children}
      </Link>
    );
  if (to === "/series")
    return (
      <Link
        className="home-more-link"
        search={parseMediaBrowserSearch({}, latestMediaBrowserDefaults)}
        to="/series"
      >
        {children}
      </Link>
    );
  return (
    <Link className="home-more-link" to="/libraries">
      {children}
    </Link>
  );
}

function MediaSection({
  icon,
  items,
  more,
  title,
}: {
  icon: ReactNode;
  items: MediaCard[];
  more?: ReactNode;
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <HomeScroller icon={icon} more={more} title={title}>
      {items.map((item) => (
        <HomeMediaCard item={item} key={item.itemId} />
      ))}
    </HomeScroller>
  );
}

function HomeLoading() {
  return (
    <div aria-label="正在加载首页" className="home-page" role="status">
      {Array.from({ length: 3 }, (_, row) => (
        <section className="home-section" key={row}>
          <Skeleton className="mb-4 h-7 w-36 rounded-control" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: row === 0 ? 5 : 7 }, (_, index) => (
              <Skeleton
                className={`${row === 0 ? "aspect-video w-[196px]" : "aspect-[2/3] w-40"} shrink-0 rounded-[12px]`}
                key={index}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HomePage() {
  const home = useQuery(mediaHomeQuery);
  const libraries = useQuery(mediaLibrariesQuery);

  if (home.isPending || libraries.isPending) return <HomeLoading />;
  if (home.isError || libraries.isError)
    return (
      <div className="home-page">
        <MediaErrorState
          error={home.error ?? libraries.error}
          onRetry={() => {
            void home.refetch();
            void libraries.refetch();
          }}
          subject="首页"
        />
      </div>
    );

  const data = home.data;
  if (
    libraries.data.libraries.length === 0 &&
    data.resumeItems.length === 0 &&
    data.latestMovies.length === 0 &&
    data.latestSeries.length === 0 &&
    data.favoriteItems.length === 0
  )
    return (
      <div className="home-page">
        <EmptyState
          description="当前账户没有可浏览的电影、剧集或媒体库。"
          title="媒体库还是空的"
        />
      </div>
    );

  return (
    <div className="home-page">
      {data.resumeItems.length === 0 ? null : (
        <HomeScroller
          icon={<PlayCircle fill="currentColor" size={24} />}
          title="继续观看"
        >
          {data.resumeItems.map((item) => (
            <HomeMediaCard item={item} key={item.itemId} landscape showPlay />
          ))}
        </HomeScroller>
      )}

      {libraries.data.libraries.length === 0 ? null : (
        <HomeScroller
          icon={<FolderOpen fill="currentColor" size={24} />}
          more={<MoreLink to="/libraries">更多</MoreLink>}
          title="我的媒体库"
        >
          {libraries.data.libraries.map((library) => (
            <HomeLibraryCard key={library.libraryId} library={library} />
          ))}
        </HomeScroller>
      )}

      <MediaSection
        icon={<Film size={24} />}
        items={data.latestMovies}
        more={<MoreLink to="/movies">更多</MoreLink>}
        title="最新电影"
      />
      <MediaSection
        icon={<Tv size={24} />}
        items={data.latestSeries}
        more={<MoreLink to="/series">更多</MoreLink>}
        title="最新剧集"
      />
      <MediaSection
        icon={<Heart fill="currentColor" size={24} />}
        items={data.favoriteItems}
        title="我的收藏"
      />
      {data.genreRows.map((row) => (
        <MediaSection
          icon={<Sparkles fill="currentColor" size={24} />}
          items={row.items}
          key={row.genre}
          title={row.genre}
        />
      ))}
    </div>
  );
}

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});
