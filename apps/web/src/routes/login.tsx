import { Button, ErrorState, Input, Skeleton } from "@newemby/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogIn, Server, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ApiError, getCurrentServer, getPublicUsers, login } from "../api.js";
import { AuthShell } from "../components/auth-shell.js";

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
        className="size-11 rounded-full object-cover"
        loading="lazy"
        src={avatarUrl}
        height={44}
        width={44}
      />
    );

  return (
    <span className="grid size-11 place-items-center rounded-full bg-white/5 text-body font-semibold text-text-muted">
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
      await navigate({ to: "/home" });
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
    <AuthShell>
      <div className="auth-form">
        <h1 className="auth-form-title">登录媒体服务器</h1>
        <p className="auth-form-description">
          选择公共用户，或直接输入 Emby 用户名和密码。
        </p>

        {currentServer.isLoading ? (
          <Skeleton className="h-16 rounded-[12px]" />
        ) : currentServer.isError ? (
          <div className="auth-inline-state">
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
          </div>
        ) : server === null || server === undefined ? (
          <div className="auth-inline-state">
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
          </div>
        ) : (
          <>
            <Link className="auth-server-info" to="/connect">
              <Server aria-hidden="true" className="text-accent" size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {server.name}
                </span>
                <span className="block truncate text-label text-text-muted">
                  Emby {server.version} · {server.baseUrl}
                </span>
              </span>
              <span className="text-small font-medium text-accent-hover">
                更换
              </span>
            </Link>

            <div>
              <p className="mb-2 text-small font-medium text-text-muted">
                公共用户
              </p>
              {publicUsers.isLoading ? (
                <div className="flex gap-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton
                      className="size-20 shrink-0 rounded-[12px]"
                      key={index}
                    />
                  ))}
                </div>
              ) : publicUsers.isError ? (
                <div className="auth-compact-error" role="alert">
                  无法读取公共用户，请检查服务器连接。
                  <button
                    className="font-semibold text-accent-hover"
                    onClick={() => void publicUsers.refetch()}
                    type="button"
                  >
                    重试
                  </button>
                </div>
              ) : publicUsers.data?.users.length === 0 ? (
                <div className="auth-empty-users">
                  <UserRound aria-hidden="true" size={18} />
                  没有公开用户，请直接输入用户名。
                </div>
              ) : (
                <div className="auth-user-list">
                  {publicUsers.data?.users.map((user) => (
                    <button
                      aria-pressed={username === user.name}
                      className="auth-user-button"
                      key={user.userId}
                      onClick={() => setUsername(user.name)}
                      type="button"
                    >
                      <UserAvatar avatarUrl={user.avatarUrl} name={user.name} />
                      <span className="max-w-20 truncate text-small font-medium">
                        {user.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <Input
                autoComplete="username"
                className="auth-input"
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
                className="auth-input"
                disabled={authentication.isPending}
                error={loginError}
                label="密码"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
              <Button
                className="auth-primary-button w-full"
                disabled={authentication.isPending || username.trim() === ""}
                type="submit"
              >
                <LogIn aria-hidden="true" size={18} />
                {authentication.isPending ? "正在登录…" : "登录"}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
