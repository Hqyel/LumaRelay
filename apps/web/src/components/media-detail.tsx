import type {
  EpisodeSummary,
  MediaDetail,
  PersonSummary,
  PlaybackMediaSource,
  PlaybackTrack,
} from "@newemby/contracts";
import { Button, ImageFallback } from "@newemby/ui";
import { Link } from "@tanstack/react-router";
import {
  AudioLines,
  Captions,
  CheckCircle2,
  Film,
  Heart,
  Play,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

import { mediaImageUrl } from "../api.js";
import { episodePlaybackTitle, mediaPlaybackTitle } from "../playback-title.js";
import { useFavoriteMutation } from "../use-favorite-mutation.js";
import { usePlayedMutation } from "../use-played-mutation.js";
import {
  HomeMediaCard,
  HomeScroller,
  type HomeMediaCardProps,
} from "./home-media.js";
import { PlayPreparationDialog } from "./play-preparation-dialog.js";
import type { PlaybackTarget } from "./play-preparation-dialog.js";

function formatRuntime(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function formatPlaybackClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining]
    .map((value, index) =>
      index === 0 ? value.toString() : value.toString().padStart(2, "0"),
    )
    .filter((_, index) => hours > 0 || index > 0)
    .join(":");
}

export function MediaDetailHero({
  item,
  kicker,
  overview,
  playbackTarget,
  series = false,
  title,
  visualItem = item,
}: {
  item: MediaDetail;
  kicker?: string;
  overview?: string;
  playbackTarget?: PlaybackTarget | null;
  series?: boolean;
  title?: string;
  visualItem?: MediaDetail;
}) {
  const favoriteMutation = useFavoriteMutation();
  const playedMutation = usePlayedMutation();
  const favoritePending =
    favoriteMutation.isPending &&
    favoriteMutation.variables.item.itemId === item.itemId;
  const playedPending =
    playedMutation.isPending &&
    playedMutation.variables.item.itemId === item.itemId;
  const effectivePlaybackTarget = playbackTarget ?? {
    displayTitle: mediaPlaybackTitle(item),
    itemId: item.itemId,
    playbackPositionSeconds: item.playbackPositionSeconds,
    title: item.title,
  };
  const displayGenres =
    item.genres.length > 0 ? item.genres : visualItem.genres;
  const displayOverview = overview ?? item.overview;
  const displayTitle = title ?? visualItem.title;

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
          itemId: visualItem.itemId,
          preset: "hero",
          tag: visualItem.backdropImageTag,
        })}
        width={1280}
      />
      <span aria-hidden="true" className="detail-hero-shade" />
      <div className="detail-hero-content">
        <span className="detail-kicker">
          {kicker ??
            (series
              ? item.seriesStatus === "ended"
                ? "已完结剧集"
                : "连载剧集"
              : item.kind === "episode"
                ? "单集详情"
                : item.kind === "movie"
                  ? "电影详情"
                  : "媒体详情")}
        </span>
        {visualItem.logoImageTag === undefined ? (
          <h1 className="detail-title">{displayTitle}</h1>
        ) : (
          <ImageFallback
            alt={displayTitle}
            className="detail-logo-image"
            containerClassName="detail-logo"
            height={112}
            loading="eager"
            src={mediaImageUrl({
              imageType: "logo",
              itemId: visualItem.itemId,
              preset: "logo",
              tag: visualItem.logoImageTag,
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
        {visualItem.tagline === undefined ? null : (
          <p className="detail-tagline">{visualItem.tagline}</p>
        )}
        <div className="detail-action-row">
          {series && playbackTarget == null ? (
            <Button className="detail-play-button" disabled>
              <Play aria-hidden="true" fill="currentColor" size={18} />
              正在读取单集…
            </Button>
          ) : (
            <PlayPreparationDialog
              item={effectivePlaybackTarget}
              key={effectivePlaybackTarget.itemId}
            />
          )}
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
        {displayOverview === undefined ? null : (
          <p className="detail-overview">{displayOverview}</p>
        )}
        {displayGenres.length === 0 ? null : (
          <div className="detail-genres">
            {displayGenres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function formatBitrate(bitrate: number | undefined): string | undefined {
  if (bitrate === undefined) return undefined;
  return `${(bitrate / 1_000_000).toFixed(bitrate >= 10_000_000 ? 0 : 1)} Mbps`;
}

function formatFileSize(sizeBytes: number | undefined): string | undefined {
  if (sizeBytes === undefined || sizeBytes === 0) return undefined;
  return `${(sizeBytes / 1024 ** 3).toFixed(2)} GB`;
}

type MediaFact = { label: string; value: string | undefined };

function presentFacts(facts: MediaFact[]): MediaFact[] {
  return facts.filter(
    (fact): fact is { label: string; value: string } =>
      fact.value !== undefined && fact.value !== "",
  );
}

function yesNo(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "是" : "否";
}

function resolution(
  width: number | undefined,
  height: number | undefined,
): string | undefined {
  if (width !== undefined && height !== undefined) return `${width}×${height}`;
  return height === undefined ? undefined : `${height}p`;
}

function MediaFactList({ facts }: { facts: MediaFact[] }) {
  const available = presentFacts(facts);
  if (available.length === 0) return <p>详细信息不可用</p>;
  return (
    <dl className="detail-stream-facts">
      {available.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AudioOrSubtitleStream({ track }: { track: PlaybackTrack }) {
  const audio = track.kind === "audio";
  return (
    <section className="detail-stream-column">
      <h4>
        {audio ? (
          <AudioLines aria-hidden="true" size={16} />
        ) : (
          <Captions aria-hidden="true" size={16} />
        )}
        {audio ? "音频" : "字幕"}
      </h4>
      <MediaFactList
        facts={[
          { label: "标题", value: track.displayTitle },
          { label: "语言", value: track.language },
          { label: "编解码器", value: track.codec?.toUpperCase() },
          { label: "编解码器标签", value: track.codecTag },
          { label: "配置", value: track.profile },
          { label: "布局", value: track.channelLayout },
          {
            label: "声道",
            value:
              track.channels === undefined ? undefined : `${track.channels} ch`,
          },
          { label: "比特率", value: formatBitrate(track.bitrate) },
          {
            label: "采样率",
            value:
              track.sampleRate === undefined
                ? undefined
                : `${track.sampleRate.toLocaleString("en-US")} Hz`,
          },
          { label: "默认", value: yesNo(track.isDefault) },
          { label: "强制", value: yesNo(track.isForced) },
          { label: "外部", value: yesNo(track.isExternal) },
        ]}
      />
    </section>
  );
}

export function MediaSourceDetails({
  sources,
}: {
  sources: PlaybackMediaSource[];
}) {
  if (sources.length === 0) return null;
  return (
    <section className="detail-source-section">
      <div className="detail-source-heading">
        <Film aria-hidden="true" size={20} />
        <h2>媒体信息</h2>
      </div>
      <div className="detail-source-grid">
        {sources.map((source) => (
          <article className="detail-source-card" key={source.mediaSourceId}>
            <header className="detail-source-summary">
              <h3>{source.name}</h3>
              <p>
                {[
                  source.container?.toUpperCase(),
                  formatFileSize(source.sizeBytes),
                  formatBitrate(source.bitrate),
                ]
                  .filter(Boolean)
                  .join(" · ") || "受保护的媒体源"}
              </p>
            </header>
            <div className="detail-stream-grid">
              {source.video === undefined ? null : (
                <section className="detail-stream-column">
                  <h4>
                    <Video aria-hidden="true" size={16} />
                    视频
                  </h4>
                  <MediaFactList
                    facts={[
                      { label: "标题", value: source.video.displayTitle },
                      {
                        label: "编解码器",
                        value: source.video.codec?.toUpperCase(),
                      },
                      {
                        label: "杜比 Profile",
                        value: source.video.dolbyVisionProfile,
                      },
                      {
                        label: "编解码器标签",
                        value: source.video.codecTag,
                      },
                      { label: "配置", value: source.video.profile },
                      {
                        label: "等级",
                        value: source.video.level?.toString(),
                      },
                      {
                        label: "分辨率",
                        value: resolution(
                          source.video.width,
                          source.video.height,
                        ),
                      },
                      { label: "长宽比", value: source.video.aspectRatio },
                      {
                        label: "交错",
                        value: yesNo(source.video.isInterlaced),
                      },
                      {
                        label: "帧率",
                        value:
                          source.video.frameRate === undefined
                            ? undefined
                            : source.video.frameRate
                                .toFixed(3)
                                .replace(/\.0+$/u, "")
                                .replace(/(\.\d*?)0+$/u, "$1"),
                      },
                      {
                        label: "比特率",
                        value: formatBitrate(
                          source.video.bitrate ?? source.bitrate,
                        ),
                      },
                      { label: "视频范围", value: source.video.videoRange },
                      {
                        label: "位深度",
                        value:
                          source.video.bitDepth === undefined
                            ? undefined
                            : `${source.video.bitDepth} bit`,
                      },
                      { label: "像素格式", value: source.video.pixelFormat },
                      {
                        label: "参考帧",
                        value: source.video.refFrames?.toString(),
                      },
                    ]}
                  />
                </section>
              )}
              {source.audioTracks.map((track) => (
                <AudioOrSubtitleStream
                  key={`audio-${track.index}`}
                  track={track}
                />
              ))}
              {source.subtitleTracks.map((track) => (
                <AudioOrSubtitleStream
                  key={`subtitle-${track.index}`}
                  track={track}
                />
              ))}
            </div>
          </article>
        ))}
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

export function EpisodeCard({
  episode,
  episodeCount,
}: {
  episode: EpisodeSummary;
  episodeCount: number;
}) {
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
        <Link
          aria-label={`查看 ${episode.seriesName ?? "剧集"} ${episode.name} 详情`}
          className="detail-episode-detail-link"
          params={{ id: episode.episodeId }}
          to="/item/$id"
        >
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
        </Link>
        <PlayPreparationDialog
          item={{
            displayTitle: episodePlaybackTitle(episode, episodeCount),
            itemId: episode.episodeId,
            playbackPositionSeconds: episode.playbackPositionSeconds,
            title: `${episode.seriesName ?? "剧集"} · ${episode.name}`,
          }}
          trigger={
            <button
              aria-label={`播放 ${episode.seriesName} ${episode.name}`}
              className="detail-episode-play"
              type="button"
            >
              <Play aria-hidden="true" fill="currentColor" size={42} />
            </button>
          }
        />
        {episode.runtimeSeconds === undefined ? null : (
          <span className="detail-episode-duration">
            {formatRuntime(episode.runtimeSeconds)}
          </span>
        )}
        <span className="detail-episode-state">
          {episode.playbackPositionSeconds > 0 &&
          episode.runtimeSeconds !== undefined
            ? `${formatPlaybackClock(episode.playbackPositionSeconds)} / ${formatPlaybackClock(episode.runtimeSeconds)}`
            : episode.isPlayed
              ? "已观看"
              : "未观看"}
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
      <Link
        className="detail-episode-info"
        params={{ id: episode.episodeId }}
        to="/item/$id"
      >
        <p>
          {episode.episodeNumber === undefined
            ? episode.name
            : `${episode.episodeNumber}. ${episode.name}`}
        </p>
        {episode.overview === undefined ? null : (
          <span>{episode.overview}</span>
        )}
      </Link>
    </article>
  );
}
