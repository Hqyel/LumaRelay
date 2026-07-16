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
import { CheckCircle2, Heart, Play } from "lucide-react";

import { mediaImageUrl } from "../api.js";
import { mediaItemQuery } from "../media-query.js";

function runtime(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function DetailLoading() {
  return (
    <div aria-label="正在加载媒体详情" className="space-y-8" role="status">
      <Skeleton className="aspect-[16/7] w-full rounded-panel" />
      <div className="grid grid-cols-[12rem_1fr] gap-8">
        <Skeleton className="aspect-[2/3] rounded-poster" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

function ItemPage() {
  const { id } = Route.useParams();
  const query = useQuery(mediaItemQuery(id));

  if (query.isPending) return <DetailLoading />;
  if (query.isError)
    return (
      <ErrorState
        action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
        description="无法读取这个媒体条目，请检查权限和服务器连接。"
        title="详情暂时不可用"
      />
    );

  const { item, people, relatedItems } = query.data;
  if (item.kind === "series")
    return (
      <EmptyState
        description="剧集的季与单集详情将在 M1-019 完成。"
        title={item.title}
      />
    );

  return (
    <div className="space-y-12 pb-12">
      <section className="relative isolate min-h-[31rem] overflow-hidden rounded-panel border border-border bg-surface">
        <ImageFallback
          alt={item.title}
          containerClassName="absolute inset-0"
          fetchPriority="high"
          loading="eager"
          src={mediaImageUrl({
            imageType: "backdrop",
            itemId: item.itemId,
            preset: "hero",
            tag: item.backdropImageTag,
          })}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,12,17,.98)_0%,rgba(11,12,17,.78)_46%,rgba(11,12,17,.2)_100%),linear-gradient(0deg,rgba(11,12,17,.96)_0%,transparent_65%)]" />
        <div className="relative grid min-h-[31rem] items-end gap-8 p-7 sm:grid-cols-[13rem_1fr] sm:p-10 lg:p-14">
          <ImageFallback
            alt={`${item.title} 海报`}
            containerClassName="hidden aspect-[2/3] overflow-hidden rounded-poster border border-border shadow-panel sm:block"
            loading="eager"
            src={mediaImageUrl({
              imageType: "primary",
              itemId: item.itemId,
              preset: "poster",
              tag: item.primaryImageTag,
            })}
          />
          <div className="max-w-3xl">
            {item.logoImageTag === undefined ? (
              <h1 className="text-h1 font-semibold sm:text-[3rem]">
                {item.title}
              </h1>
            ) : (
              <ImageFallback
                alt={item.title}
                className="object-contain object-left-bottom"
                containerClassName="h-28 max-w-xl bg-transparent"
                loading="eager"
                src={mediaImageUrl({
                  imageType: "logo",
                  itemId: item.itemId,
                  preset: "logo",
                  tag: item.logoImageTag,
                })}
              />
            )}
            <p className="mt-4 text-body text-text-muted">
              {[
                item.productionYear,
                runtime(item.runtimeSeconds),
                item.officialRating,
                item.communityRating === undefined
                  ? undefined
                  : `★ ${item.communityRating.toFixed(1)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {item.tagline === undefined ? null : (
              <p className="mt-4 text-body italic text-text">{item.tagline}</p>
            )}
            {item.overview === undefined ? null : (
              <p className="mt-4 line-clamp-5 text-body leading-7 text-text-muted">
                {item.overview}
              </p>
            )}
            {item.genres.length === 0 ? null : (
              <div className="mt-5 flex flex-wrap gap-2">
                {item.genres.map((genre) => (
                  <span
                    className="rounded-full border border-border bg-surface/70 px-3 py-1 text-small"
                    key={genre}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <Button disabled title="本地播放将在 M2 开放">
                <Play aria-hidden="true" fill="currentColor" size={18} />
                播放
              </Button>
              <Button
                disabled
                title="收藏操作将在 M1-021 开放"
                variant="secondary"
              >
                <Heart
                  aria-hidden="true"
                  fill={item.isFavorite ? "currentColor" : "none"}
                  size={18}
                />
                {item.isFavorite ? "已收藏" : "收藏"}
              </Button>
              <Button
                disabled
                title="观看状态将在 M1-022 开放"
                variant="secondary"
              >
                <CheckCircle2 aria-hidden="true" size={18} />
                {item.isPlayed ? "已看" : "标记已看"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {people.length === 0 ? null : (
        <section aria-labelledby="cast-heading" className="space-y-5">
          <h2 className="text-h2 font-semibold" id="cast-heading">
            演职人员
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
            {people.slice(0, 12).map((person) => (
              <article
                className="text-center"
                key={`${person.personId}-${person.kind}`}
              >
                <ImageFallback
                  alt={person.name}
                  containerClassName="aspect-square rounded-full"
                  loading="lazy"
                  src={mediaImageUrl({
                    imageType: "primary",
                    itemId: person.personId,
                    preset: "avatar",
                    tag: person.primaryImageTag,
                  })}
                />
                <h3 className="mt-3 font-semibold">{person.name}</h3>
                {person.role === undefined ? null : (
                  <p className="mt-1 text-small text-text-muted">
                    {person.role}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {relatedItems.length === 0 ? null : (
        <section aria-labelledby="related-heading" className="space-y-5">
          <h2 className="text-h2 font-semibold" id="related-heading">
            相关推荐
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {relatedItems.slice(0, 12).map((related) => (
              <PosterCard
                action={
                  <Button asChild size="small" variant="secondary">
                    <Link params={{ id: related.itemId }} to="/item/$id">
                      查看详情
                    </Link>
                  </Button>
                }
                favorite={related.isFavorite}
                imageUrl={mediaImageUrl({
                  imageType: "primary",
                  itemId: related.itemId,
                  preset: "poster",
                  tag: related.primaryImageTag,
                })}
                key={related.itemId}
                subtitle={related.productionYear?.toString()}
                title={related.title}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/item/$id")({
  component: ItemPage,
});
