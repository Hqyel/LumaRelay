import type { MediaCard } from "@newemby/contracts";
import {
  Button,
  EmptyState,
  ErrorState,
  ImageFallback,
  Input,
  PosterCard,
  Skeleton,
} from "@newemby/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { mediaImageUrl } from "../api.js";
import { mediaSearchQuery } from "../media-query.js";

const RECENT_SEARCHES_KEY = "newemby.recent-searches";

export interface SearchState {
  q: string;
}

function parseSearch(search: Record<string, unknown>): SearchState {
  return { q: typeof search.q === "string" ? search.q.slice(0, 200) : "" };
}

function recentSearches(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string")
          .slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

function saveRecent(searchTerm: string): void {
  if (searchTerm === "") return;
  const next = [
    searchTerm,
    ...recentSearches().filter((item) => item !== searchTerm),
  ].slice(0, 6);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

function MediaGroup({ items, title }: { items: MediaCard[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`${title}-search-heading`} className="space-y-4">
      <h2 className="text-h2 font-semibold" id={`${title}-search-heading`}>
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <PosterCard
            action={
              <Button
                disabled
                size="small"
                title="详情将在后续任务开放"
                variant="secondary"
              >
                查看详情
              </Button>
            }
            favorite={item.isFavorite}
            imageUrl={mediaImageUrl({
              imageType: "primary",
              itemId: item.itemId,
              preset: "poster",
              tag: item.primaryImageTag,
            })}
            key={item.itemId}
            subtitle={item.productionYear?.toString() ?? item.subtitle}
            title={item.title}
          />
        ))}
      </div>
    </section>
  );
}

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [term, setTerm] = useState(q);
  const [recent, setRecent] = useState<string[]>(recentSearches);
  const normalized = q.trim();
  const results = useQuery(mediaSearchQuery(normalized));

  useEffect(() => setTerm(q), [q]);
  useEffect(() => {
    const next = term.trim();
    if (next === normalized) return;
    const timer = window.setTimeout(() => {
      void navigate({ replace: true, search: { q: next } });
      if (next !== "") {
        saveRecent(next);
        setRecent(recentSearches());
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [navigate, normalized, term]);

  const hasResults =
    results.data !== undefined &&
    (results.data.movies.length > 0 ||
      results.data.series.length > 0 ||
      results.data.episodes.length > 0 ||
      results.data.people.length > 0);

  return (
    <div className="space-y-10 pb-12">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-label font-semibold uppercase tracking-[0.16em] text-accent">
          全局发现
        </p>
        <h1 className="mt-2 text-h1 font-semibold">搜索媒体库</h1>
        <div className="relative mt-6 text-left">
          <Search
            aria-hidden="true"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
            size={20}
          />
          <Input
            autoComplete="off"
            className="pl-12"
            label="搜索电影、剧集、单集或人物"
            name="media-search"
            onChange={(event) => setTerm(event.currentTarget.value)}
            placeholder="输入名称开始搜索"
            spellCheck={false}
            value={term}
          />
        </div>
      </header>

      {normalized === "" ? (
        <section className="mx-auto max-w-3xl">
          <h2 className="text-h2 font-semibold">最近搜索</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-body text-text-muted">还没有搜索记录。</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {recent.map((item) => (
                <Button
                  key={item}
                  onClick={() => setTerm(item)}
                  variant="secondary"
                >
                  {item}
                </Button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {normalized !== "" && results.isPending ? (
        <div
          aria-label="正在搜索"
          className="grid grid-cols-2 gap-5 sm:grid-cols-4"
          role="status"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="aspect-[2/3] rounded-poster" key={index} />
          ))}
        </div>
      ) : null}
      {results.isError ? (
        <ErrorState
          action={
            <Button onClick={() => void results.refetch()}>重新搜索</Button>
          }
          description="无法完成搜索，请检查服务器连接后重试。"
          title="搜索暂时不可用"
        />
      ) : null}
      {normalized !== "" && results.isSuccess && !hasResults ? (
        <EmptyState
          description="尝试缩短关键词，或改用类型和年份浏览。"
          title={`没有找到“${normalized}”`}
        />
      ) : null}
      {results.data === undefined ? null : (
        <div className="space-y-10">
          <MediaGroup items={results.data.movies} title="电影" />
          <MediaGroup items={results.data.series} title="剧集" />
          <MediaGroup items={results.data.episodes} title="单集" />
          {results.data.people.length === 0 ? null : (
            <section
              aria-labelledby="people-search-heading"
              className="space-y-4"
            >
              <h2 className="text-h2 font-semibold" id="people-search-heading">
                人物
              </h2>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
                {results.data.people.map((person) => (
                  <article className="text-center" key={person.personId}>
                    <ImageFallback
                      alt={person.name}
                      containerClassName="mx-auto aspect-square w-full rounded-full"
                      loading="lazy"
                      src={mediaImageUrl({
                        imageType: "primary",
                        itemId: person.personId,
                        preset: "avatar",
                        tag: person.primaryImageTag,
                      })}
                    />
                    <h3 className="mt-3 font-semibold">{person.name}</h3>
                    {person.role === undefined ? null : (
                      <p className="mt-1 text-small text-text-muted">
                        {person.role}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/search")({
  component: SearchPage,
  validateSearch: parseSearch,
});
