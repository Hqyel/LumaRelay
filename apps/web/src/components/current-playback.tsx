import type { LocalPlaybackStatusItem } from "@newemby/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Pause, Play, Radio } from "lucide-react";

import { fetchLocalPlaybackStatus } from "../bridge-client.js";
import { bridgeStatusQuery } from "../bridge-query.js";
import { mediaItemQuery } from "../media-query.js";

const TICKS_PER_SECOND = 10_000_000;

function formatTime(ticks: number): string {
  const totalSeconds = Math.floor(ticks / TICKS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function stateLabel(session: LocalPlaybackStatusItem): string {
  if (session.state === "playing") return "正在播放";
  if (session.state === "paused") return "已暂停";
  if (session.state === "ended") return "播放完成";
  if (session.state === "stopped") return "播放已停止";
  if (session.state === "unavailable") return "同步不可用";
  return "正在连接 PotPlayer";
}

function warningLabel(
  warning: LocalPlaybackStatusItem["warning"],
): string | null {
  if (warning === "SMTC_STALE") return "播放器时间线已停止更新";
  if (warning === "SMTC_AMBIGUOUS") return "检测到多个匹配会话，未猜测绑定";
  if (warning === "SMTC_MATCH_TIMEOUT") return "未能匹配 PotPlayer 媒体会话";
  if (warning === "PLAYER_EXITED") return "PotPlayer 已退出";
  if (warning === "SMTC_NOT_MATCHED") return "正在等待 PotPlayer 媒体会话";
  return null;
}

export function CurrentPlayback() {
  const { data: bridge } = useQuery(bridgeStatusQuery);
  const paired = bridge?.isPaired === true;
  const statusQuery = useQuery({
    enabled: paired,
    queryFn: ({ signal }) => fetchLocalPlaybackStatus(signal),
    queryKey: ["local-bridge", "playback-status"],
    refetchInterval: 1_000,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 500,
  });
  const session = statusQuery.data?.sessions[0];
  const itemQuery = useQuery({
    ...mediaItemQuery(session?.itemId ?? ""),
    enabled: session !== undefined,
  });
  if (session === undefined) return null;

  const progress =
    session.durationTicks <= 0
      ? 0
      : Math.min(100, (session.positionTicks / session.durationTicks) * 100);
  const warning = warningLabel(session.warning);
  const StateIcon =
    session.state === "paused"
      ? Pause
      : session.state === "playing"
        ? Play
        : session.syncState === "unavailable" || session.syncState === "stale"
          ? AlertTriangle
          : Radio;

  return (
    <aside
      aria-label="当前本地播放"
      className={`current-playback current-playback-${session.syncState}`}
    >
      <div className="current-playback-heading">
        <span className="current-playback-state">
          <StateIcon aria-hidden="true" size={15} />
          {stateLabel(session)}
        </span>
        <small>
          {formatTime(session.positionTicks)} /{" "}
          {formatTime(session.durationTicks)}
        </small>
      </div>
      <Link
        className="current-playback-title"
        params={{ id: session.itemId }}
        to="/item/$id"
      >
        {itemQuery.data?.item.title ?? "PotPlayer 本地播放"}
      </Link>
      <div
        aria-label="播放进度"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progress)}
        className="current-playback-progress"
        role="progressbar"
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      {warning === null ? (
        <p>进度由本机 Bridge 与 SMTC 实时同步</p>
      ) : (
        <p aria-live="polite" className="current-playback-warning">
          {warning}
        </p>
      )}
    </aside>
  );
}
