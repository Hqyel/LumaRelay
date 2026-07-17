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
import type { ReactNode } from "react";

import { mediaImageUrl } from "../api.js";

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
      search={{ page: 1 }}
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
