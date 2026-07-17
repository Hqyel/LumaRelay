import type { MediaItemResponse } from "@newemby/contracts";
import { Button, EmptyState, ErrorState } from "@newemby/ui";
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
import {
  mediaItemQuery,
  seriesEpisodesQuery,
  seriesSeasonsQuery,
} from "../media-query.js";

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
      <MediaDetailHero item={item} series />
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
          <ErrorState
            action={
              <Button onClick={() => void seasons.refetch()}>重新加载</Button>
            }
            description="无法读取这个剧集的季信息，请稍后重试。"
            title="季列表暂时不可用"
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
          <ErrorState
            action={
              <Button onClick={() => void episodes.refetch()}>重新加载</Button>
            }
            description="无法读取所选季的单集，请稍后重试。"
            title="单集列表暂时不可用"
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
              <EpisodeCard episode={episode} key={episode.episodeId} />
            ))}
          </HomeScroller>
        )}
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
      <ErrorState
        action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
        description="无法读取这个媒体条目，请检查权限和服务器连接。"
        title="详情暂时不可用"
      />
    );

  const { item, people, relatedItems } = query.data;
  if (item.kind === "series") return <SeriesDetail detail={query.data} />;

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
