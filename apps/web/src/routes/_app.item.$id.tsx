import type { MediaItemResponse } from "@newemby/contracts";
import { EmptyState } from "@newemby/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Tv } from "lucide-react";
import { useEffect, useState } from "react";

import { HomeScroller } from "../components/home-media.js";
import {
  EpisodeCard,
  MediaDetailHero,
  PeopleScroller,
  RelatedScroller,
} from "../components/media-detail.js";
import { MediaErrorState } from "../components/media-state.js";
import {
  mediaItemQuery,
  seriesEpisodesQuery,
  seriesSeasonsQuery,
} from "../media-query.js";
import { episodePlaybackTitle, mediaPlaybackTitle } from "../playback-title.js";

function DetailLoading() {
  return (
    <div aria-label="正在加载媒体详情" className="detail-loading" role="status">
      <span className="detail-loading-hero" />
      <span className="detail-loading-line detail-loading-title" />
      <span className="detail-loading-line" />
      <span className="detail-loading-line detail-loading-short" />
    </div>
  );
}

function SeriesDetail({ detail }: { detail: MediaItemResponse }) {
  const { item, people, relatedItems } = detail;
  const seasons = useQuery(seriesSeasonsQuery(item.itemId));
  const [seasonId, setSeasonId] = useState<string>();

  useEffect(() => {
    const available = seasons.data?.seasons ?? [];
    if (
      available.length > 0 &&
      !available.some((season) => season.seasonId === seasonId)
    )
      setSeasonId(
        available.find((season) => season.unplayedEpisodeCount > 0)?.seasonId ??
          available.at(-1)?.seasonId,
      );
  }, [seasonId, seasons.data]);

  const episodes = useQuery(seriesEpisodesQuery(item.itemId, seasonId));
  const playbackEpisode =
    episodes.data?.episodes.find(
      (episode) => !episode.isPlayed && episode.playbackPositionSeconds > 0,
    ) ??
    episodes.data?.episodes.find((episode) => !episode.isPlayed) ??
    episodes.data?.episodes[0];
  const playbackTarget =
    playbackEpisode === undefined
      ? null
      : {
          displayTitle: episodePlaybackTitle(
            playbackEpisode,
            episodes.data?.episodes.length,
          ),
          itemId: playbackEpisode.episodeId,
          playbackPositionSeconds: playbackEpisode.playbackPositionSeconds,
          title: `${item.title} · ${playbackEpisode.name}`,
        };
  const seasonSelector =
    seasons.data === undefined || seasons.data.seasons.length === 0 ? null : (
      <label className="detail-season-selector">
        <span className="sr-only">选择季</span>
        <select
          onChange={(event) => setSeasonId(event.currentTarget.value)}
          value={seasonId ?? ""}
        >
          {seasons.data.seasons.map((season) => (
            <option key={season.seasonId} value={season.seasonId}>
              {season.name}
              {season.unplayedEpisodeCount > 0
                ? ` · ${season.unplayedEpisodeCount} 集未看`
                : ""}
            </option>
          ))}
        </select>
      </label>
    );

  return (
    <div className="detail-page">
      <MediaDetailHero item={item} playbackTarget={playbackTarget} series />
      <div className="detail-content">
        {seasons.isPending ? (
          <div
            aria-label="正在加载季"
            className="detail-inline-loading"
            role="status"
          >
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {seasons.isError ? (
          <MediaErrorState
            error={seasons.error}
            onRetry={() => void seasons.refetch()}
            subject="季列表"
          />
        ) : null}
        {seasons.isSuccess && seasons.data.seasons.length === 0 ? (
          <EmptyState
            description="当前用户没有可浏览的季或单集。"
            title="没有可用单集"
          />
        ) : null}
        {seasonId !== undefined && episodes.isPending ? (
          <div
            aria-label="正在加载单集"
            className="detail-inline-loading"
            role="status"
          >
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {episodes.isError ? (
          <MediaErrorState
            error={episodes.error}
            onRetry={() => void episodes.refetch()}
            subject="单集列表"
          />
        ) : null}
        {episodes.data?.episodes.length === 0 ? (
          <EmptyState
            description="所选季没有当前用户可浏览的单集。"
            title="这一季是空的"
          />
        ) : null}
        {episodes.data === undefined ||
        episodes.data.episodes.length === 0 ? null : (
          <HomeScroller
            icon={<Tv size={20} />}
            more={seasonSelector}
            title="季与单集"
          >
            {episodes.data.episodes.map((episode) => (
              <EpisodeCard
                episode={episode}
                episodeCount={episodes.data.episodes.length}
                key={episode.episodeId}
              />
            ))}
          </HomeScroller>
        )}
        <PeopleScroller people={people} />
        <RelatedScroller items={relatedItems} />
      </div>
    </div>
  );
}

function EpisodeDetail({ detail }: { detail: MediaItemResponse }) {
  const { item, people, relatedItems } = detail;
  const episodes = useQuery(
    seriesEpisodesQuery(item.seriesId ?? "", item.seasonId),
  );
  const playbackTarget = {
    displayTitle: mediaPlaybackTitle(item, episodes.data?.episodes.length),
    itemId: item.itemId,
    playbackPositionSeconds: item.playbackPositionSeconds,
    title: `${item.subtitle ?? "剧集"} · ${item.title}`,
  };

  return (
    <div className="detail-page">
      <MediaDetailHero item={item} playbackTarget={playbackTarget} />
      <div className="detail-content">
        <PeopleScroller people={people} />
        <RelatedScroller items={relatedItems} />
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
      <MediaErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        subject="媒体详情"
      />
    );

  const { item, people, relatedItems } = query.data;
  if (item.kind === "series") return <SeriesDetail detail={query.data} />;
  if (item.kind === "episode") return <EpisodeDetail detail={query.data} />;

  return (
    <div className="detail-page">
      <MediaDetailHero item={item} />
      <div className="detail-content">
        <PeopleScroller people={people} />
        <RelatedScroller items={relatedItems} />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/item/$id")({
  component: ItemPage,
});
