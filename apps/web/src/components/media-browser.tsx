import type { MediaLibrary } from "@newemby/contracts";
import {
  ImageFallback,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@newemby/ui";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Folder,
  Music2,
  Tv,
} from "lucide-react";
import { useId, type FormEvent, type ReactNode } from "react";

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

const allValue = "__newemby_all__";

function formValue(data: FormData, name: string) {
  const value = data.get(name);
  return value === allValue ? "" : String(value ?? "");
}

function FilterSelect({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: string;
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
}) {
  const labelId = useId();

  return (
    <div className="media-filter-field">
      <span id={labelId}>{label}</span>
      <Select defaultValue={defaultValue || allValue} name={name}>
        <SelectTrigger
          aria-labelledby={labelId}
          className="media-filter-select"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value || allValue}
              value={option.value || allValue}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
      favorite: formValue(data, "favorite") === "true" ? true : undefined,
      genre: listValue(data.get("genre")),
      kind:
        showKinds && formValue(data, "kind") !== ""
          ? [formValue(data, "kind") as MediaBrowserSearch["kind"][number]]
          : [],
      libraryId:
        libraries !== undefined && formValue(data, "libraryId") !== ""
          ? formValue(data, "libraryId")
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
      playState: formValue(
        data,
        "playState",
      ) as MediaBrowserSearch["playState"],
      seriesStatus: showSeriesStatus
        ? (formValue(
            data,
            "seriesStatus",
          ) as MediaBrowserSearch["seriesStatus"])
        : "any",
      sortBy: formValue(data, "sortBy") as MediaBrowserSearch["sortBy"],
      sortOrder: formValue(
        data,
        "sortOrder",
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
        <FilterSelect
          defaultValue={search.libraryId ?? ""}
          label="媒体库"
          name="libraryId"
          options={[
            { label: "全部媒体库", value: "" },
            ...libraries.map((library) => ({
              label: library.name,
              value: library.libraryId,
            })),
          ]}
        />
      )}
      {showKinds ? (
        <FilterSelect
          defaultValue={search.kind.length === 1 ? (search.kind[0] ?? "") : ""}
          label="类型"
          name="kind"
          options={[
            { label: "电影、剧集和视频", value: "" },
            { label: "电影", value: "movie" },
            { label: "剧集", value: "series" },
            { label: "视频", value: "video" },
          ]}
        />
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
      <FilterSelect
        defaultValue={search.playState}
        label="观看状态"
        name="playState"
        options={[
          { label: "全部", value: "any" },
          { label: "未看", value: "unplayed" },
          { label: "已看", value: "played" },
        ]}
      />
      <FilterSelect
        defaultValue={search.favorite ? "true" : ""}
        label="收藏状态"
        name="favorite"
        options={[
          { label: "全部", value: "" },
          { label: "仅收藏", value: "true" },
        ]}
      />
      {showSeriesStatus ? (
        <FilterSelect
          defaultValue={search.seriesStatus}
          label="剧集状态"
          name="seriesStatus"
          options={[
            { label: "全部", value: "any" },
            { label: "连载中", value: "continuing" },
            { label: "已完结", value: "ended" },
          ]}
        />
      ) : null}
      <FilterSelect
        defaultValue={search.sortBy}
        label="排序"
        name="sortBy"
        options={[
          { label: "名称", value: "name" },
          { label: "首映日期", value: "premiereDate" },
          { label: "加入日期", value: "dateAdded" },
          { label: "年份", value: "productionYear" },
          { label: "社区评分", value: "communityRating" },
        ]}
      />
      <FilterSelect
        defaultValue={search.sortOrder}
        label="顺序"
        name="sortOrder"
        options={[
          { label: "升序", value: "ascending" },
          { label: "降序", value: "descending" },
        ]}
      />
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
            height={56}
            loading="lazy"
            src={mediaImageUrl({
              imageType: "primary",
              itemId: library.libraryId,
              preset: "card",
              tag: library.primaryImageTag,
            })}
            width={56}
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
