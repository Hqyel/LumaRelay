import type {
  EpisodeSummary,
  MediaDetail,
  PersonSummary,
} from "@newemby/contracts";
import { Button, ImageFallback } from "@newemby/ui";
import { CheckCircle2, Heart, Play, Sparkles, Users } from "lucide-react";

import { mediaImageUrl } from "../api.js";
import { useFavoriteMutation } from "../use-favorite-mutation.js";
import { usePlayedMutation } from "../use-played-mutation.js";
import {
  HomeMediaCard,
  HomeScroller,
  type HomeMediaCardProps,
} from "./home-media.js";

function formatRuntime(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

export function MediaDetailHero({
  item,
  series = false,
}: {
  item: MediaDetail;
  series?: boolean;
}) {
  const favoriteMutation = useFavoriteMutation();
  const playedMutation = usePlayedMutation();
  const favoritePending =
    favoriteMutation.isPending &&
    favoriteMutation.variables.item.itemId === item.itemId;
  const playedPending =
    playedMutation.isPending &&
    playedMutation.variables.item.itemId === item.itemId;

  return (
    <section className="detail-hero">
      <ImageFallback
        alt=""
        className="detail-hero-image"
        containerClassName="detail-hero-backdrop"
        fetchPriority="high"
        height={720}
        loading="eager"
        src={mediaImageUrl({
          imageType: "backdrop",
          itemId: item.itemId,
          preset: "hero",
          tag: item.backdropImageTag,
        })}
        width={1280}
      />
      <span aria-hidden="true" className="detail-hero-shade" />
      <div className="detail-hero-content">
        <span className="detail-kicker">
          {series
            ? item.seriesStatus === "ended"
              ? "已完结剧集"
              : "连载剧集"
            : "电影详情"}
        </span>
        {item.logoImageTag === undefined ? (
          <h1 className="detail-title">{item.title}</h1>
        ) : (
          <ImageFallback
            alt={item.title}
            className="detail-logo-image"
            containerClassName="detail-logo"
            height={112}
            loading="eager"
            src={mediaImageUrl({
              imageType: "logo",
              itemId: item.itemId,
              preset: "logo",
              tag: item.logoImageTag,
            })}
            width={480}
          />
        )}
        <div className="detail-meta">
          {[
            item.productionYear,
            formatRuntime(item.runtimeSeconds),
            item.officialRating,
          ]
            .filter(Boolean)
            .map((value) => (
              <span key={value}>{value}</span>
            ))}
          {item.communityRating === undefined ? null : (
            <span className="detail-rating">
              ★ {item.communityRating.toFixed(1)}
            </span>
          )}
        </div>
        {item.tagline === undefined ? null : (
          <p className="detail-tagline">{item.tagline}</p>
        )}
        <div className="detail-action-row">
          <Button
            className="detail-play-button"
            disabled
            title="本地播放将在 M2 开放"
          >
            <Play aria-hidden="true" fill="currentColor" size={18} />
            播放
          </Button>
          <Button
            aria-pressed={item.isFavorite}
            disabled={favoritePending}
            onClick={() =>
              favoriteMutation.mutate({
                favorite: !item.isFavorite,
                item,
              })
            }
            title={item.isFavorite ? "取消收藏" : "收藏"}
            variant="secondary"
          >
            <Heart
              aria-hidden="true"
              fill={item.isFavorite ? "currentColor" : "none"}
              size={18}
            />
            {favoritePending
              ? "正在更新…"
              : item.isFavorite
                ? "已收藏"
                : "收藏"}
          </Button>
          <Button
            aria-pressed={item.isPlayed}
            disabled={playedPending}
            onClick={() =>
              playedMutation.mutate({ item, played: !item.isPlayed })
            }
            title={item.isPlayed ? "标记未看" : "标记已看"}
            variant="secondary"
          >
            <CheckCircle2 aria-hidden="true" size={18} />
            {playedPending
              ? "正在更新…"
              : item.isPlayed
                ? "标记未看"
                : "标记已看"}
          </Button>
        </div>
        {favoriteMutation.isError || playedMutation.isError ? (
          <p aria-live="polite" className="detail-action-error" role="alert">
            {playedMutation.isError ? "观看" : "收藏"}
            状态更新失败，已恢复原状态，请重试。
          </p>
        ) : null}
        {item.overview === undefined ? null : (
          <p className="detail-overview">{item.overview}</p>
        )}
        {item.genres.length === 0 ? null : (
          <div className="detail-genres">
            {item.genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function PeopleScroller({ people }: { people: PersonSummary[] }) {
  if (people.length === 0) return null;
  return (
    <HomeScroller icon={<Users size={20} />} title="演职人员">
      {people.slice(0, 20).map((person) => (
        <article
          className="detail-person"
          key={`${person.personId}-${person.kind}`}
        >
          <ImageFallback
            alt={person.name}
            className="detail-person-image"
            containerClassName="detail-person-avatar"
            height={192}
            loading="lazy"
            src={mediaImageUrl({
              imageType: "primary",
              itemId: person.personId,
              preset: "avatar",
              tag: person.primaryImageTag,
            })}
            width={192}
          />
          <h3>{person.name}</h3>
          {person.role === undefined ? null : <p>{person.role}</p>}
        </article>
      ))}
    </HomeScroller>
  );
}

export function RelatedScroller({
  items,
}: {
  items: HomeMediaCardProps["item"][];
}) {
  if (items.length === 0) return null;
  return (
    <HomeScroller icon={<Sparkles size={20} />} title="相关推荐">
      {items.slice(0, 12).map((item) => (
        <HomeMediaCard item={item} key={item.itemId} />
      ))}
    </HomeScroller>
  );
}

export function EpisodeCard({ episode }: { episode: EpisodeSummary }) {
  const progress =
    episode.runtimeSeconds === undefined || episode.runtimeSeconds === 0
      ? 0
      : Math.min(
          100,
          (episode.playbackPositionSeconds / episode.runtimeSeconds) * 100,
        );

  return (
    <article className="detail-episode-card">
      <div className="detail-episode-thumb">
        <ImageFallback
          alt={episode.name}
          className="detail-episode-image"
          containerClassName="size-full"
          height={360}
          loading="lazy"
          src={mediaImageUrl({
            imageType: "primary",
            itemId: episode.episodeId,
            preset: "card",
            tag: episode.primaryImageTag,
          })}
          width={640}
        />
        <span aria-hidden="true" className="detail-episode-play">
          <Play fill="currentColor" size={42} />
        </span>
        {episode.runtimeSeconds === undefined ? null : (
          <span className="detail-episode-duration">
            {formatRuntime(episode.runtimeSeconds)}
          </span>
        )}
        <span className="detail-episode-state">
          {episode.isPlayed ? "已观看" : "未观看"}
        </span>
        {progress <= 0 ? null : (
          <span
            aria-label={`播放进度 ${Math.round(progress)}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progress)}
            className="detail-episode-progress"
            role="progressbar"
          >
            <span style={{ width: `${progress}%` }} />
          </span>
        )}
      </div>
      <div className="detail-episode-info">
        <p>
          {episode.episodeNumber === undefined
            ? episode.name
            : `${episode.episodeNumber}. ${episode.name}`}
        </p>
        {episode.overview === undefined ? null : (
          <span>{episode.overview}</span>
        )}
      </div>
    </article>
  );
}
