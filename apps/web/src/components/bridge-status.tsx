import { Button, Dialog } from "@lumarelay/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  MonitorPlay,
  Radio,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { createBridgePairingCode } from "../api.js";
import { bridgeCapabilityModel, bridgePairingUri } from "../bridge-client.js";
import { bridgeStatusQuery } from "../bridge-query.js";

function CapabilityRow({
  detail,
  label,
  state,
}: {
  detail: string;
  label: string;
  state: "ready" | "warning" | "unknown";
}) {
  const Icon =
    state === "ready"
      ? CheckCircle2
      : state === "warning"
        ? CircleAlert
        : CircleDashed;
  return (
    <li className={`bridge-capability bridge-capability-${state}`}>
      <Icon aria-hidden="true" size={18} />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </li>
  );
}

export function BridgeStatusControl() {
  const [open, setOpen] = useState(false);
  const {
    data: bridgeStatus,
    isFetching,
    refetch,
  } = useQuery(bridgeStatusQuery);
  const model = bridgeCapabilityModel(bridgeStatus);
  const pairingMutation = useMutation({ mutationFn: createBridgePairingCode });
  const pairingUri = useMemo(() => {
    if (pairingMutation.data === undefined) return undefined;
    return bridgePairingUri(
      window.location.origin,
      pairingMutation.data.pairingCode,
    );
  }, [pairingMutation.data]);

  useEffect(() => {
    if (!open || pairingUri === undefined) return;
    const interval = window.setInterval(() => void refetch(), 1_500);
    return () => window.clearInterval(interval);
  }, [open, pairingUri, refetch]);

  const connected =
    model.availability === "connected" && model.isPaired === true;
  const statusLabel = connected
    ? "Bridge 已连接"
    : model.availability === "incompatible"
      ? "Bridge 版本不兼容"
      : "Bridge 未连接";

  return (
    <Dialog
      description="检查本机便携版 Bridge、PotPlayer 与进度同步能力。"
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void refetch();
      }}
      open={open}
      title="本地播放连接"
      trigger={
        <button
          aria-label={`${statusLabel}，打开本地播放连接设置`}
          className={`bridge-status-trigger ${connected ? "is-connected" : ""}`}
          type="button"
        >
          <span aria-hidden="true" className="bridge-status-dot" />
          {statusLabel}
        </button>
      }
    >
      <div className="bridge-setup">
        <ul aria-label="本地播放能力" className="bridge-capabilities">
          <CapabilityRow
            detail={
              connected
                ? `版本 ${model.status?.bridgeVersion ?? "未知"}，API 兼容`
                : model.availability === "incompatible"
                  ? "已响应，但 API 版本与当前网页不兼容"
                  : "可能未运行，或尚未允许当前网页连接"
            }
            label="LumaRelay Player Bridge"
            state={
              connected
                ? "ready"
                : model.availability === "incompatible"
                  ? "warning"
                  : "unknown"
            }
          />
          <CapabilityRow
            detail={
              model.playerAvailable
                ? `已发现 ${model.playerVersion ?? "受支持版本"}${model.playerRunning ? "，正在运行" : ""}`
                : "未发现受支持的 PotPlayer 便携版或安装版"
            }
            label="PotPlayer"
            state={model.playerAvailable ? "ready" : "unknown"}
          />
          <CapabilityRow
            detail={
              model.smtcReady
                ? "系统媒体会话监听正常"
                : connected
                  ? "当前无法确认系统媒体会话监听能力"
                  : "连接 Bridge 后检测"
            }
            label="SMTC 进度同步"
            state={
              model.smtcReady ? "ready" : connected ? "warning" : "unknown"
            }
          />
        </ul>

        {connected ? (
          <div className="bridge-ready-message" role="status">
            <Radio aria-hidden="true" size={18} />
            本机已可以接收 LumaRelay 的播放请求。
          </div>
        ) : (
          <section className="bridge-portable-guide">
            <h3>连接便携版</h3>
            <ol>
              <li>
                解压并运行 `LumaRelay.PlayerBridge.exe`，保持托盘程序运行。
              </li>
              <li>
                生成一次性配对请求，再允许浏览器打开 LumaRelay Player Bridge。
              </li>
              <li>配对完成后，本页会自动重新检测，无需刷新。</li>
            </ol>
            {pairingUri === undefined ? (
              <Button
                disabled={pairingMutation.isPending}
                onClick={() => pairingMutation.mutate()}
              >
                <MonitorPlay aria-hidden="true" size={18} />
                {pairingMutation.isPending ? "正在生成…" : "生成配对请求"}
              </Button>
            ) : (
              <Button asChild>
                <a href={pairingUri}>
                  <MonitorPlay aria-hidden="true" size={18} />
                  打开 Bridge 完成配对
                </a>
              </Button>
            )}
            {pairingMutation.data === undefined ? null : (
              <p aria-live="polite" className="bridge-pairing-expiry">
                此配对请求将在 60 秒内失效；失效后可重新生成。
              </p>
            )}
            {pairingMutation.isError ? (
              <p
                aria-live="assertive"
                className="bridge-pairing-error"
                role="alert"
              >
                无法生成配对请求，请确认登录状态后重试。
              </p>
            ) : null}
          </section>
        )}

        <div className="bridge-dialog-actions">
          <Button
            disabled={isFetching}
            onClick={() => void refetch()}
            variant="secondary"
          >
            <RefreshCw
              aria-hidden="true"
              className={isFetching ? "animate-spin" : ""}
              size={16}
            />
            重新检测
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
