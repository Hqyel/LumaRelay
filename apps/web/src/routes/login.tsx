import {
  BrandMark,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
} from "@newemby/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LogIn, Server, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { getCurrentServer, getPublicUsers } from "../api.js";

function UserAvatar({ avatarUrl, name }: { avatarUrl?: string; name: string }) {
  if (avatarUrl !== undefined)
    return (
      <img
        alt=""
        className="size-14 rounded-full object-cover"
        loading="lazy"
        src={avatarUrl}
      />
    );

  return (
    <span className="grid size-14 place-items-center rounded-full bg-surface-hover text-h3 font-semibold text-text-muted">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function LoginPage() {
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const currentServer = useQuery({
    queryFn: getCurrentServer,
    queryKey: ["server", "current"],
  });
  const publicUsers = useQuery({
    enabled: currentServer.data?.server !== null,
    queryFn: getPublicUsers,
    queryKey: ["auth", "public-users"],
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const server = currentServer.data?.server;

  return (
    <main className="min-h-screen bg-bg px-5 py-10 text-text">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-panel border border-border bg-surface p-6 shadow-panel sm:p-9">
          <div className="mb-8 flex items-center gap-4">
            <BrandMark className="size-12 text-accent" title="NewEmby" />
            <div>
              <p className="text-small font-semibold text-accent">NewEmby</p>
              <h1 className="text-h2 font-semibold">登录媒体服务器</h1>
            </div>
          </div>

          {currentServer.isLoading ? (
            <Skeleton className="mb-7 h-16" />
          ) : server === null || server === undefined ? (
            <ErrorState
              action={
                <Button asChild variant="secondary">
                  <a href="/connect">选择服务器</a>
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
                  label="用户名"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  value={username}
                />
                <Input
                  autoComplete="current-password"
                  label="密码"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
                <Button disabled type="submit">
                  <LogIn aria-hidden="true" size={18} />
                  登录认证将在下一项任务启用
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

          {publicUsers.isLoading ? (
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
