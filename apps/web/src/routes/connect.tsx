import { BrandMark, Button, ErrorState, Input } from "@newemby/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Server } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { ApiError, getCurrentServer, selectServer } from "../api.js";

const ERROR_MESSAGES: Record<string, string> = {
  SERVER_NOT_ALLOWED: "该服务器不在部署允许列表中。",
  SERVER_TIMEOUT: "连接服务器超时，请稍后重试。",
  SERVER_TLS_ERROR: "服务器证书校验失败。",
  SERVER_UNREACHABLE: "无法连接到 Emby 服务器。",
  SERVER_VERSION_UNSUPPORTED: "该 Emby 版本暂不受支持。",
};

function ConnectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState("");
  const currentServer = useQuery({
    queryFn: getCurrentServer,
    queryKey: ["server", "current"],
  });
  const selection = useMutation({
    mutationFn: selectServer,
    async onSuccess(response) {
      queryClient.setQueryData(["server", "current"], {
        configuredBaseUrl: response.server.baseUrl,
        requestId: response.requestId,
        server: response.server,
      });
      await navigate({ to: "/login" });
    },
  });

  useEffect(() => {
    if (baseUrl !== "" || currentServer.data === undefined) return;

    setBaseUrl(
      currentServer.data.server?.baseUrl ??
        currentServer.data.configuredBaseUrl,
    );
  }, [baseUrl, currentServer.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    selection.mutate(baseUrl);
  }

  const error = selection.error;
  const errorMessage =
    error instanceof ApiError
      ? (ERROR_MESSAGES[error.code] ?? error.message)
      : error instanceof Error
        ? error.message
        : undefined;

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-12 text-text">
      <section className="w-full max-w-xl rounded-panel border border-border bg-surface p-6 shadow-panel sm:p-10">
        <div className="mb-8 flex items-center gap-4">
          <BrandMark className="size-12 text-accent" title="NewEmby" />
          <div>
            <p className="text-small font-semibold text-accent-hover">
              NewEmby
            </p>
            <h1 className="text-h2 font-semibold">连接媒体服务器</h1>
          </div>
        </div>

        <p className="mb-7 text-body text-text-muted">
          首版只连接部署允许列表中的一个 Emby 服务器。
        </p>

        {currentServer.isError ? (
          <div className="mb-6">
            <ErrorState
              action={
                <Button
                  onClick={() => currentServer.refetch()}
                  variant="secondary"
                >
                  重试读取
                </Button>
              }
              description="仍可重新输入服务器地址并尝试连接。"
              title="无法读取当前服务器"
            />
          </div>
        ) : null}

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <Input
            autoComplete="url"
            disabled={currentServer.isLoading || selection.isPending}
            error={errorMessage}
            hint="请输入完整的 HTTP 或 HTTPS 地址"
            label="Emby 服务器地址"
            name="embyBaseUrl"
            onChange={(event) => setBaseUrl(event.target.value)}
            required
            spellCheck={false}
            type="url"
            value={baseUrl}
          />
          <Button disabled={selection.isPending} type="submit">
            <Server aria-hidden="true" size={18} />
            {selection.isPending ? "正在探测…" : "连接服务器"}
          </Button>
        </form>

        {currentServer.data?.server === undefined ||
        currentServer.data.server === null ? null : (
          <div className="mt-6 flex gap-3 rounded-control border border-success/25 bg-success/10 p-4">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-success"
              size={20}
            />
            <div>
              <p className="font-semibold">{currentServer.data.server.name}</p>
              <p className="mt-1 text-small text-text-muted">
                Emby {currentServer.data.server.version} · 最近延迟{" "}
                {currentServer.data.server.latencyMs} ms
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export const Route = createFileRoute("/connect")({
  component: ConnectPage,
});
