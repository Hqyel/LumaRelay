import type { MediaLibrary } from "@newemby/contracts";
import { ImageFallback } from "@newemby/ui";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Folder,
  Music2,
  Tv,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import { mediaImageUrl } from "../api.js";
import {
  libraryMediaBrowserDefaults,
  parseMediaBrowserSearch,
  type MediaBrowserSearch,
} from "../media-browser-search.js";

export function MediaBrowserPage({ children }: { children: ReactNode }) {
  return <div className="media-browser-page">{children}</div>;
}

export function MediaBrowserHeader({
  eyebrow,
  page,
  pageCount,
  title,
  total,
  unit,
}: {
  eyebrow: string;
  page?: number;
  pageCount?: number;
  title: string;
  total: number;
  unit: string;
}) {
  return (
    <header className="media-browser-header">
      <div className="media-browser-heading">
        <span aria-hidden="true" className="media-browser-eyebrow">
          {eyebrow}
        </span>
        <div className="media-browser-title-row">
          <h2 className="media-browser-title">{title}</h2>
          <span className="media-browser-count">
            {total} {unit}
          </span>
        </div>
      </div>
      {page === undefined || pageCount === undefined ? null : (
        <span className="media-browser-page-count">
          第 {page} / {pageCount} 页
        </span>
      )}
    </header>
  );
}

export function MediaBrowserGrid({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section aria-label={label} className="media-browser-grid">
      {children}
    </section>
  );
}

function listValue(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

export function MediaBrowserFilters({
  libraries,
  onApply,
  onReset,
  search,
  showKinds = false,
  showSeriesStatus = false,
}: {
  libraries?: MediaLibrary[];
  onApply: (search: MediaBrowserSearch) => void;
  onReset: () => void;
  search: MediaBrowserSearch;
  showKinds?: boolean;
  showSeriesStatus?: boolean;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rawMinRating = data.get("minCommunityRating");
    const minRating = rawMinRating === "" ? undefined : Number(rawMinRating);
    onApply({
      favorite: data.get("favorite") === "true" ? true : undefined,
      genre: listValue(data.get("genre")),
      kind:
        showKinds && data.get("kind") !== ""
          ? [String(data.get("kind")) as MediaBrowserSearch["kind"][number]]
          : [],
      libraryId:
        libraries !== undefined && data.get("libraryId") !== ""
          ? String(data.get("libraryId"))
          : undefined,
      minCommunityRating:
        minRating !== undefined &&
        Number.isFinite(minRating) &&
        minRating >= 0 &&
        minRating <= 10
          ? minRating
          : undefined,
      officialRating: listValue(data.get("officialRating")),
      page: 1,
      playState: String(
        data.get("playState"),
      ) as MediaBrowserSearch["playState"],
      seriesStatus: showSeriesStatus
        ? (String(
            data.get("seriesStatus"),
          ) as MediaBrowserSearch["seriesStatus"])
        : "any",
      sortBy: String(data.get("sortBy")) as MediaBrowserSearch["sortBy"],
      sortOrder: String(
        data.get("sortOrder"),
      ) as MediaBrowserSearch["sortOrder"],
      year: listValue(data.get("year"))
        .map(Number)
        .filter((value) => Number.isInteger(value))
        .sort((left, right) => left - right),
    });
  }

  return (
    <form
      className="media-filter-panel"
      key={JSON.stringify(search)}
      onSubmit={submit}
    >
      {libraries === undefined ? null : (
        <label className="media-filter-field">
          <span>媒体库</span>
          <select defaultValue={search.libraryId ?? ""} name="libraryId">
            <option value="">全部媒体库</option>
            {libraries.map((library) => (
              <option key={library.libraryId} value={library.libraryId}>
                {library.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {showKinds ? (
        <label className="media-filter-field">
          <span>类型</span>
          <select
            defaultValue={search.kind.length === 1 ? search.kind[0] : ""}
            name="kind"
          >
            <option value="">电影、剧集和视频</option>
            <option value="movie">电影</option>
            <option value="series">剧集</option>
            <option value="video">视频</option>
          </select>
        </label>
      ) : null}
      <label className="media-filter-field media-filter-wide">
        <span>类型标签</span>
        <input
          defaultValue={search.genre.join(", ")}
          name="genre"
          placeholder="科幻, 剧情"
        />
      </label>
      <label className="media-filter-field">
        <span>年份</span>
        <input
          defaultValue={search.year.join(", ")}
          inputMode="numeric"
          name="year"
          placeholder="2026, 2025"
        />
      </label>
      <label className="media-filter-field">
        <span>分级</span>
        <input
          defaultValue={search.officialRating.join(", ")}
          name="officialRating"
          placeholder="PG-13"
        />
      </label>
      <label className="media-filter-field">
        <span>最低评分</span>
        <input
          defaultValue={search.minCommunityRating ?? ""}
          max="10"
          min="0"
          name="minCommunityRating"
          placeholder="0–10"
          step="0.1"
          type="number"
        />
      </label>
      <label className="media-filter-field">
        <span>观看状态</span>
        <select defaultValue={search.playState} name="playState">
          <option value="any">全部</option>
          <option value="unplayed">未看</option>
          <option value="played">已看</option>
        </select>
      </label>
      <label className="media-filter-field">
        <span>收藏状态</span>
        <select defaultValue={search.favorite ? "true" : ""} name="favorite">
          <option value="">全部</option>
          <option value="true">仅收藏</option>
        </select>
      </label>
      {showSeriesStatus ? (
        <label className="media-filter-field">
          <span>剧集状态</span>
          <select defaultValue={search.seriesStatus} name="seriesStatus">
            <option value="any">全部</option>
            <option value="continuing">连载中</option>
            <option value="ended">已完结</option>
          </select>
        </label>
      ) : null}
      <label className="media-filter-field">
        <span>排序</span>
        <select defaultValue={search.sortBy} name="sortBy">
          <option value="name">名称</option>
          <option value="premiereDate">首映日期</option>
          <option value="dateAdded">加入日期</option>
          <option value="productionYear">年份</option>
          <option value="communityRating">社区评分</option>
        </select>
      </label>
      <label className="media-filter-field">
        <span>顺序</span>
        <select defaultValue={search.sortOrder} name="sortOrder">
          <option value="ascending">升序</option>
          <option value="descending">降序</option>
        </select>
      </label>
      <div className="media-filter-actions">
        <button className="media-filter-reset" onClick={onReset} type="button">
          重置
        </button>
        <button className="media-filter-submit" type="submit">
          应用筛选
        </button>
      </div>
    </form>
  );
}

export function MediaBrowserLoading({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="media-browser-page media-browser-loading"
      role="status"
    >
      <div className="media-browser-loading-header" />
      <div className="media-browser-grid">
        {Array.from({ length: 12 }, (_, index) => (
          <span className="media-browser-poster-skeleton" key={index} />
        ))}
      </div>
    </div>
  );
}

export function MediaBrowserPagination({
  busy,
  onNext,
  onPrevious,
  page,
  pageCount,
}: {
  busy: boolean;
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  pageCount: number;
}) {
  return (
    <nav aria-label="媒体分页" className="media-browser-pagination">
      <button
        className="media-browser-page-button"
        disabled={page <= 1 || busy}
        onClick={onPrevious}
        type="button"
      >
        <ChevronLeft aria-hidden="true" size={17} />
        上一页
      </button>
      <span className="media-browser-page-indicator">
        {page} / {pageCount}
      </span>
      <button
        className="media-browser-page-button"
        disabled={page >= pageCount || busy}
        onClick={onNext}
        type="button"
      >
        下一页
        <ChevronRight aria-hidden="true" size={17} />
      </button>
    </nav>
  );
}

function libraryIcon(kind: MediaLibrary["kind"]) {
  if (kind === "movies") return <Clapperboard aria-hidden="true" size={28} />;
  if (kind === "series") return <Tv aria-hidden="true" size={28} />;
  if (kind === "music") return <Music2 aria-hidden="true" size={28} />;
  return <Folder aria-hidden="true" size={28} />;
}

function libraryType(kind: MediaLibrary["kind"]): string {
  if (kind === "movies") return "电影";
  if (kind === "series") return "电视剧";
  if (kind === "music") return "音乐";
  return "其他";
}

export function LibraryBrowserCard({ library }: { library: MediaLibrary }) {
  return (
    <Link
      className="media-library-list-item"
      params={{ libraryId: library.libraryId }}
      search={parseMediaBrowserSearch({}, libraryMediaBrowserDefaults)}
      to="/library/$libraryId"
    >
      <span className="media-library-list-art">
        {library.primaryImageTag === undefined ? (
          libraryIcon(library.kind)
        ) : (
          <ImageFallback
            alt=""
            className="size-full object-cover"
            containerClassName="size-full"
            loading="lazy"
            src={mediaImageUrl({
              imageType: "primary",
              itemId: library.libraryId,
              preset: "card",
              tag: library.primaryImageTag,
            })}
          />
        )}
      </span>
      <span className="media-library-list-info">
        <span className="media-library-list-name">{library.name}</span>
        <span className="media-library-list-type">
          {libraryType(library.kind)}
          {library.itemCount === undefined
            ? ""
            : ` · ${library.itemCount} 个条目`}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="media-library-list-arrow"
        size={24}
      />
    </Link>
  );
}
