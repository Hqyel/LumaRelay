import {
  BrandMark,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
} from "@newemby/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogIn, Server, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ApiError, getCurrentServer, getPublicUsers, login } from "../api.js";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "用户名或密码不正确。",
  AUTH_UPSTREAM_ERROR: "Emby 登录服务暂时不可用。",
  ORIGIN_NOT_ALLOWED: "当前页面来源不允许登录。",
  RATE_LIMITED: "登录尝试过多，请十分钟后重试。",
  SERVER_TIMEOUT: "登录请求超时，请稍后重试。",
};

function UserAvatar({ avatarUrl, name }: { avatarUrl?: string; name: string }) {
  if (avatarUrl !== undefined)
    return (
      <img
        alt=""
        className="size-14 rounded-full object-cover"
        loading="lazy"
        src={avatarUrl}
        height={56}
        width={56}
      />
    );

  return (
    <span className="grid size-14 place-items-center rounded-full bg-surface-hover text-h3 font-semibold text-text-muted">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const currentServer = useQuery({
    queryFn: getCurrentServer,
    queryKey: ["server", "current"],
  });
  const publicUsers = useQuery({
    enabled:
      currentServer.data?.server !== undefined &&
      currentServer.data.server !== null,
    queryFn: getPublicUsers,
    queryKey: ["auth", "public-users"],
  });
  const authentication = useMutation({
    mutationFn: login,
    async onSuccess() {
      await navigate({ to: "/" });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authentication.mutate({ password, username });
  }

  const server = currentServer.data?.server;
  const loginError =
    authentication.error instanceof ApiError
      ? (LOGIN_ERROR_MESSAGES[authentication.error.code] ??
        authentication.error.message)
      : authentication.error instanceof Error
        ? authentication.error.message
        : undefined;

  return (
    <main className="min-h-screen bg-bg px-5 py-10 text-text">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-panel border border-border bg-surface p-6 shadow-panel sm:p-9">
          <div className="mb-8 flex items-center gap-4">
            <BrandMark className="size-12 text-accent" title="NewEmby" />
            <div>
              <p className="text-small font-semibold text-accent-hover">
                NewEmby
              </p>
              <h1 className="text-h2 font-semibold">登录媒体服务器</h1>
            </div>
          </div>

          {currentServer.isLoading ? (
            <Skeleton className="mb-7 h-16" />
          ) : currentServer.isError ? (
            <ErrorState
              action={
                <Button
                  onClick={() => currentServer.refetch()}
                  variant="secondary"
                >
                  重试读取
                </Button>
              }
              description="请检查 Gateway 是否可用。"
              title="无法读取当前服务器"
            />
          ) : server === null || server === undefined ? (
            <ErrorState
              action={
                <Button asChild variant="secondary">
                  <Link to="/connect">选择服务器</Link>
                </Button>
              }
              description="登录前需要先完成服务器连接。"
              icon={<Server size={22} />}
              title="尚未连接服务器"
            />
          ) : (
            <>
              <div className="mb-7 rounded-control border border-border bg-bg-elevated p-4">
                <p className="font-semibold">{server.name}</p>
                <p className="mt-1 text-small text-text-muted">
                  Emby {server.version} · {server.baseUrl}
                </p>
              </div>

              <form className="grid gap-5" onSubmit={handleSubmit}>
                <Input
                  autoComplete="username"
                  disabled={authentication.isPending}
                  label="用户名"
                  name="username"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  spellCheck={false}
                  value={username}
                />
                <Input
                  autoComplete="current-password"
                  disabled={authentication.isPending}
                  error={loginError}
                  label="密码"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
                <Button
                  disabled={authentication.isPending || username.trim() === ""}
                  type="submit"
                >
                  <LogIn aria-hidden="true" size={18} />
                  {authentication.isPending ? "正在登录…" : "登录"}
                </Button>
              </form>
            </>
          )}
        </section>

        <section className="rounded-panel border border-border bg-surface p-6 shadow-panel sm:p-9">
          <div className="mb-6">
            <h2 className="text-h3 font-semibold">选择公共用户</h2>
            <p className="mt-2 text-body text-text-muted">
              这里只显示服务器管理员允许公开展示的用户。
            </p>
          </div>

          {currentServer.isError ? (
            <ErrorState
              description="恢复服务器状态后再读取公共用户。"
              title="公共用户暂不可用"
            />
          ) : server === null || server === undefined ? (
            <EmptyState
              description="连接服务器后会显示允许公开展示的用户。"
              icon={<UserRound size={22} />}
              title="等待连接服务器"
            />
          ) : publicUsers.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="h-28" key={index} />
              ))}
            </div>
          ) : publicUsers.isError ? (
            <ErrorState
              action={
                <Button
                  onClick={() => publicUsers.refetch()}
                  variant="secondary"
                >
                  重试
                </Button>
              }
              description="请检查 Gateway 与 Emby 服务器连接。"
              title="无法读取公共用户"
            />
          ) : publicUsers.data?.users.length === 0 ? (
            <EmptyState
              description="可以直接在左侧输入用户名和密码。"
              icon={<UserRound size={22} />}
              title="没有公开用户"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {publicUsers.data?.users.map((user) => (
                <button
                  aria-pressed={username === user.name}
                  className="grid min-h-32 place-items-center gap-3 rounded-control border border-border bg-bg-elevated p-4 text-center hover:border-accent/55 hover:bg-surface-hover aria-pressed:border-accent aria-pressed:bg-accent/10"
                  key={user.userId}
                  onClick={() => setUsername(user.name)}
                  type="button"
                >
                  <UserAvatar avatarUrl={user.avatarUrl} name={user.name} />
                  <span className="font-semibold">{user.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
