import type { PlaybackMediaSource } from "@newemby/contracts";
import { Button, Dialog } from "@newemby/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Play, Radio } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, createPlayTicket } from "../api.js";
import {
  bridgeCapabilityModel,
  LocalBridgeError,
  startLocalPlayback,
} from "../bridge-client.js";
import { bridgeStatusQuery } from "../bridge-query.js";
import { playbackOptionsQuery } from "../media-query.js";

function formatResume(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function firstSource(
  sources: PlaybackMediaSource[],
): PlaybackMediaSource | undefined {
  return sources.find((source) => source.supportsDirectStream) ?? sources[0];
}

export interface PlaybackTarget {
  displayTitle: string;
  itemId: string;
  playbackPositionSeconds: number;
  title: string;
}

function startErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "PLAYBACK_SELECTION_INVALID")
      return "媒体源或默认音字幕已变化，请关闭弹层后重新选择。";
    if (error.code === "BRIDGE_DEVICE_NOT_FOUND")
      return "当前 Bridge 配对已失效，请在顶栏重新配对。";
    return `Gateway 无法准备播放（${error.code}）。`;
  }
  if (error instanceof LocalBridgeError) {
    if (error.code === "PLAYER_NOT_FOUND")
      return "未找到受支持的 PotPlayer，请检查便携版位置。";
    if (error.code === "PLAY_TICKET_REDEEM_FAILED")
      return "Bridge 无法兑换播放票据，请检查 Gateway 连接后重试。";
    return `Bridge 无法启动播放（${error.code}）。`;
  }
  return "本地播放启动失败，请检查 Bridge 与 Gateway 后重试。";
}

export function PlayPreparationDialog({
  item,
  trigger,
}: {
  item: PlaybackTarget;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [audioIndex, setAudioIndex] = useState<number | null>(null);
  const [subtitleIndex, setSubtitleIndex] = useState<number | null>(null);
  const [allowWithoutSync, setAllowWithoutSync] = useState(false);
  const statusQuery = useQuery(bridgeStatusQuery);
  const bridge = bridgeCapabilityModel(statusQuery.data);
  const optionsQuery = useQuery({
    ...playbackOptionsQuery(item.itemId),
    enabled: open,
  });
  const selectedSource = useMemo(
    () =>
      optionsQuery.data?.sources.find(
        (source) => source.mediaSourceId === sourceId,
      ),
    [optionsQuery.data, sourceId],
  );

  useEffect(() => {
    const source = firstSource(optionsQuery.data?.sources ?? []);
    if (source === undefined || sourceId !== "") return;
    setSourceId(source.mediaSourceId);
    setAudioIndex(source.defaultAudioStreamIndex);
    setSubtitleIndex(source.defaultSubtitleStreamIndex);
  }, [optionsQuery.data, sourceId]);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (selectedSource === undefined || statusQuery.data?.deviceId == null)
        throw new Error("Local playback is not ready");
      const issued = await createPlayTicket({
        audioStreamIndex: audioIndex,
        deviceId: statusQuery.data.deviceId,
        displayTitle: item.displayTitle,
        itemId: item.itemId,
        mediaSourceId: selectedSource.mediaSourceId,
        resumeTicks: item.playbackPositionSeconds * 10_000_000,
        subtitleStreamIndex: subtitleIndex,
      });
      return startLocalPlayback(issued.playTicket);
    },
    onSuccess() {
      window.setTimeout(() => setOpen(false), 600);
    },
  });

  const connected = bridge.availability === "connected" && bridge.isPaired;
  const canStart =
    connected &&
    bridge.playerAvailable &&
    selectedSource !== undefined &&
    (bridge.smtcReady || allowWithoutSync);

  return (
    <Dialog
      description={`在 PotPlayer 中播放“${item.title}”，Token 不会发送到本机播放器。`}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) startMutation.reset();
      }}
      open={open}
      title="本地播放准备"
      trigger={
        trigger ?? (
          <Button className="detail-play-button">
            <Play aria-hidden="true" fill="currentColor" size={18} />
            {item.playbackPositionSeconds > 0 ? "继续播放" : "播放"}
          </Button>
        )
      }
    >
      <div className="play-preparation">
        <div className="play-preparation-status">
          <span className={connected ? "is-ready" : "is-warning"}>
            {connected ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            {connected ? "Bridge 已连接" : "Bridge 未连接"}
          </span>
          <span className={bridge.playerAvailable ? "is-ready" : "is-warning"}>
            {bridge.playerAvailable ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            {bridge.playerAvailable ? "PotPlayer 已发现" : "未发现 PotPlayer"}
          </span>
          <span className={bridge.smtcReady ? "is-ready" : "is-warning"}>
            {bridge.smtcReady ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            {bridge.smtcReady ? "SMTC 同步可用" : "SMTC 同步不可用"}
          </span>
        </div>

        {optionsQuery.isPending ? (
          <div
            aria-label="正在读取播放信息"
            className="play-preparation-loading"
            role="status"
          />
        ) : null}
        {optionsQuery.isError ? (
          <div className="play-preparation-warning" role="alert">
            无法读取播放信息，请检查 Emby 连接后重试。
          </div>
        ) : null}
        {optionsQuery.data?.sources.length === 0 ? (
          <div className="play-preparation-warning" role="alert">
            当前条目没有可供 PotPlayer 直接串流的媒体源。
          </div>
        ) : null}

        {selectedSource === undefined ? null : (
          <div className="play-preparation-fields">
            <label>
              <span>播放版本</span>
              <select
                onChange={(event) => {
                  const source = optionsQuery.data?.sources.find(
                    (candidate) =>
                      candidate.mediaSourceId === event.currentTarget.value,
                  );
                  if (source === undefined) return;
                  setSourceId(source.mediaSourceId);
                  setAudioIndex(source.defaultAudioStreamIndex);
                  setSubtitleIndex(source.defaultSubtitleStreamIndex);
                }}
                value={sourceId}
              >
                {optionsQuery.data?.sources.map((source) => (
                  <option
                    key={source.mediaSourceId}
                    value={source.mediaSourceId}
                  >
                    {source.name}
                    {source.container === undefined
                      ? ""
                      : ` · ${source.container.toUpperCase()}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>音轨</span>
              <select
                onChange={(event) =>
                  setAudioIndex(Number(event.currentTarget.value))
                }
                value={audioIndex ?? ""}
              >
                {selectedSource.audioTracks.map((track) => (
                  <option key={track.index} value={track.index}>
                    {track.displayTitle}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>字幕</span>
              <select
                onChange={(event) =>
                  setSubtitleIndex(
                    event.currentTarget.value === ""
                      ? null
                      : Number(event.currentTarget.value),
                  )
                }
                value={subtitleIndex ?? ""}
              >
                <option value="">关闭字幕</option>
                {selectedSource.subtitleTracks
                  .filter((track) => track.isText)
                  .map((track) => (
                    <option key={track.index} value={track.index}>
                      {track.displayTitle}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}

        {item.playbackPositionSeconds > 0 ? (
          <p className="play-preparation-resume">
            将从 {formatResume(item.playbackPositionSeconds)} 继续播放。
          </p>
        ) : null}
        <p className="play-preparation-policy">
          进度每 10 秒同步；短时间试播若未达到 Emby
          媒体库设置的最小续播百分比，服务器不会生成“继续观看”记录。
        </p>

        {!connected ? (
          <div className="play-preparation-warning">
            请先使用顶栏的 Bridge 状态入口运行并配对便携版。
          </div>
        ) : !bridge.smtcReady ? (
          <label className="play-preparation-degraded">
            <input
              checked={allowWithoutSync}
              onChange={(event) =>
                setAllowWithoutSync(event.currentTarget.checked)
              }
              type="checkbox"
            />
            <span>
              仅启动，不同步进度
              <small>请先在 PotPlayer 设置中启用“使用系统媒体传输控制”。</small>
            </span>
          </label>
        ) : null}

        {startMutation.isError ? (
          <p
            aria-live="assertive"
            className="play-preparation-error"
            role="alert"
          >
            {startErrorMessage(startMutation.error)}
          </p>
        ) : null}
        {startMutation.isSuccess ? (
          <p
            aria-live="polite"
            className="play-preparation-success"
            role="status"
          >
            <Radio aria-hidden="true" size={16} /> PotPlayer 正在启动…
          </p>
        ) : null}

        <div className="play-preparation-actions">
          <Button
            disabled={
              !canStart || startMutation.isPending || startMutation.isSuccess
            }
            onClick={() => startMutation.mutate()}
          >
            <Play aria-hidden="true" fill="currentColor" size={17} />
            {startMutation.isPending ? "正在准备…" : "使用 PotPlayer 播放"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
