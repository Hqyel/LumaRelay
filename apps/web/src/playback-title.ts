import type { EpisodeSummary, MediaCard } from "@lumarelay/contracts";

const MAXIMUM_PLAYER_TITLE_LENGTH = 256;

function clean(value: string | undefined): string | undefined {
  const cleaned = [...(value ?? "")]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();
  return cleaned === "" ? undefined : cleaned;
}

function limit(value: string): string {
  return value.slice(0, MAXIMUM_PLAYER_TITLE_LENGTH);
}

export function episodePlaybackTitle(
  episode: Pick<EpisodeSummary, "episodeNumber" | "name" | "seriesName">,
  episodeCount?: number,
): string {
  const seriesName = clean(episode.seriesName);
  const episodeName = clean(episode.name);
  const position =
    episode.episodeNumber === undefined
      ? undefined
      : episodeCount === undefined
        ? `第${episode.episodeNumber}集`
        : `第${episode.episodeNumber}/${episodeCount}集`;
  const parts = [seriesName, episodeName, position].filter(
    (part): part is string => part !== undefined,
  );
  return limit(parts.join("-") || "LumaRelay");
}

export function mediaPlaybackTitle(
  item: Pick<MediaCard, "episodeNumber" | "kind" | "subtitle" | "title">,
  episodeCount?: number,
): string {
  if (item.kind === "episode") {
    return episodePlaybackTitle(
      {
        episodeNumber: item.episodeNumber,
        name: item.title,
        seriesName: item.subtitle,
      },
      episodeCount,
    );
  }
  return limit(clean(item.title) ?? "LumaRelay");
}
