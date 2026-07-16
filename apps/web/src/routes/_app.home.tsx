import type { MediaCard } from "@newemby/contracts";
import {
  Button,
  EmptyState,
  ErrorState,
  ImageFallback,
  PosterCard,
  Skeleton,
} from "@newemby/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Info, Play } from "lucide-react";

import { mediaImageUrl } from "../api.js";
import { mediaHomeQuery } from "../media-query.js";

function remaining(item: MediaCard): string {
  const seconds = Math.max(
    0,
    (item.runtimeSeconds ?? 0) - item.playbackPositionSeconds,
  );
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分钟`;
}

function posterImage(item: MediaCard) {
  return mediaImageUrl({
    imageType: "primary",
    itemId: item.itemId,
    preset: "poster",
    tag: item.primaryImageTag,
  });
}

function MediaPosterRow({
  items,
  title,
}: {
  items: MediaCard[];
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={`${title}-heading`} className="space-y-4">
      <h2 className="text-h2 font-semibold" id={`${title}-heading`}>
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {items.slice(0, 12).map((item) => (
          <PosterCard
            action={
              <Button asChild size="small" variant="secondary">
                <Link params={{ id: item.itemId }} to="/item/$id">
                  查看详情
                </Link>
              </Button>
            }
            favorite={item.isFavorite}
            imageUrl={posterImage(item)}
            key={item.itemId}
            progress={item.playedPercentage}
            subtitle={item.productionYear?.toString() ?? item.subtitle}
            title={item.title}
            unwatchedCount={item.unplayedItemCount}
          />
        ))}
      </div>
    </section>
  );
}

function HomeLoading() {
  return (
    <div aria-label="正在加载首页" className="space-y-10" role="status">
      <Skeleton className="aspect-[16/7] w-full rounded-panel" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="aspect-video rounded-panel" key={index} />
        ))}
      </div>
    </div>
  );
}

function HomePage() {
  const home = useQuery(mediaHomeQuery);

  if (home.isPending) return <HomeLoading />;
  if (home.isError)
    return (
      <ErrorState
        action={<Button onClick={() => void home.refetch()}>重新加载</Button>}
        description="无法从媒体服务器读取首页，请检查服务器连接后重试。"
        title="首页暂时不可用"
      />
    );

  const data = home.data;
  if (
    data.hero === null &&
    data.resumeItems.length === 0 &&
    data.latestMovies.length === 0 &&
    data.latestSeries.length === 0
  )
    return (
      <EmptyState
        description="当前账户没有可浏览的电影或剧集。"
        title="媒体库还是空的"
      />
    );

  return (
    <div className="space-y-12 pb-12">
      {data.hero === null ? null : (
        <section className="relative isolate min-h-[26rem] overflow-hidden rounded-panel border border-border bg-surface">
          <ImageFallback
            alt={data.hero.title}
            className="object-cover"
            containerClassName="absolute inset-0"
            fetchPriority="high"
            loading="eager"
            src={mediaImageUrl({
              imageType: "backdrop",
              itemId: data.hero.itemId,
              preset: "hero",
              tag: data.hero.backdropImageTag,
            })}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,12,17,.98)_0%,rgba(11,12,17,.72)_48%,rgba(11,12,17,.18)_100%),linear-gradient(0deg,rgba(11,12,17,.95)_0%,transparent_55%)]" />
          <div className="relative flex min-h-[26rem] max-w-3xl flex-col justify-end p-7 sm:p-10 lg:p-14">
            <p className="mb-3 text-label font-semibold uppercase tracking-[0.18em] text-accent">
              NewEmby 精选
            </p>
            <h1 className="text-h1 font-semibold sm:text-[3rem]">
              {data.hero.title}
            </h1>
            <p className="mt-3 text-body text-text-muted">
              {[data.hero.productionYear, data.hero.officialRating]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {data.hero.overview === undefined ? null : (
              <p className="mt-5 line-clamp-3 max-w-2xl text-body leading-7 text-text-muted">
                {data.hero.overview}
              </p>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <Button disabled title="本地播放将在 M2 开放">
                <Play aria-hidden="true" fill="currentColor" size={18} />
                播放
              </Button>
              <Button asChild variant="secondary">
                <Link params={{ id: data.hero.itemId }} to="/item/$id">
                  <Info aria-hidden="true" size={18} />
                  查看详情
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {data.resumeItems.length === 0 ? null : (
        <section aria-labelledby="resume-heading" className="space-y-4">
          <h2 className="text-h2 font-semibold" id="resume-heading">
            继续观看
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.resumeItems.slice(0, 6).map((item) => (
              <article
                className="group overflow-hidden rounded-panel border border-border bg-surface shadow-card transition-transform hover:-translate-y-1"
                key={item.itemId}
              >
                <div className="relative aspect-video">
                  <ImageFallback
                    alt={item.title}
                    containerClassName="size-full"
                    loading="lazy"
                    src={mediaImageUrl({
                      imageType: item.backdropImageTag ? "backdrop" : "primary",
                      itemId: item.itemId,
                      preset: "card",
                      tag: item.backdropImageTag ?? item.primaryImageTag,
                    })}
                  />
                  <span
                    aria-label={`播放进度 ${Math.round(item.playedPercentage ?? 0)}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={Math.round(item.playedPercentage ?? 0)}
                    className="absolute inset-x-0 bottom-0 h-1 bg-black/60"
                    role="progressbar"
                  >
                    <span
                      className="block h-full bg-accent"
                      style={{ width: `${item.playedPercentage ?? 0}%` }}
                    />
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="truncate font-semibold">{item.title}</h3>
                  <p className="mt-1 text-small text-text-muted">
                    剩余 {remaining(item)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <MediaPosterRow items={data.latestMovies} title="最近添加电影" />
      <MediaPosterRow items={data.latestSeries} title="最近更新剧集" />
      <MediaPosterRow items={data.favoriteItems} title="我的收藏" />
      {data.genreRows.map((row) => (
        <MediaPosterRow items={row.items} key={row.genre} title={row.genre} />
      ))}
    </div>
  );
}

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});
