import type { MediaCard, MediaLibrary } from "@newemby/contracts";
import { ImageFallback } from "@newemby/ui";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, PlayCircle, Star } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { mediaImageUrl } from "../api.js";

interface DragState {
  blocked: boolean;
  dragging: boolean;
  scrollLeft: number;
  startX: number;
}

export function HomeScroller({
  children,
  icon,
  more,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  more?: ReactNode;
  title: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState>({
    blocked: false,
    dragging: false,
    scrollLeft: 0,
    startX: 0,
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [dragging, setDragging] = useState(false);

  const checkScroll = useCallback(() => {
    const element = container.current;
    if (element === null) return;
    setCanScrollLeft(element.scrollLeft > 1);
    setCanScrollRight(
      element.scrollLeft < element.scrollWidth - element.clientWidth - 1,
    );
  }, []);

  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    const observer = new ResizeObserver(checkScroll);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();

    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll, children]);

  useEffect(() => {
    const element = container.current;

    function start(event: MouseEvent) {
      if (element === null || event.button !== 0) return;
      drag.current = {
        blocked: false,
        dragging: true,
        scrollLeft: element.scrollLeft,
        startX: event.pageX,
      };
      setDragging(true);
    }

    function move(event: MouseEvent) {
      if (!drag.current.dragging || element === null) return;
      const delta = event.pageX - drag.current.startX;
      if (Math.abs(delta) > 5) drag.current.blocked = true;
      element.scrollLeft = drag.current.scrollLeft - delta * 1.5;
      event.preventDefault();
    }

    function stop() {
      if (!drag.current.dragging) return;
      drag.current.dragging = false;
      setDragging(false);
      window.setTimeout(() => {
        drag.current.blocked = false;
      });
    }

    function blockClick(event: MouseEvent) {
      if (!drag.current.blocked) return;
      event.preventDefault();
      event.stopPropagation();
    }

    element?.addEventListener("mousedown", start);
    element?.addEventListener("click", blockClick, true);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    return () => {
      element?.removeEventListener("mousedown", start);
      element?.removeEventListener("click", blockClick, true);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
  }, []);

  function scroll(direction: -1 | 1) {
    const element = container.current;
    if (element === null) return;
    element.scrollBy({
      behavior: "smooth",
      left: direction * element.clientWidth * 0.8,
    });
  }

  return (
    <section aria-labelledby={`${title}-home-heading`} className="home-section">
      <div className="home-scroller-header">
        <h2 className="home-section-title" id={`${title}-home-heading`}>
          <span aria-hidden="true" className="home-section-icon">
            {icon}
          </span>
          {title}
        </h2>
        <div className="home-header-actions">
          {more}
          <button
            aria-label={`向左浏览${title}`}
            className="home-nav-button"
            disabled={!canScrollLeft}
            onClick={() => scroll(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <button
            aria-label={`向右浏览${title}`}
            className="home-nav-button"
            disabled={!canScrollRight}
            onClick={() => scroll(1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
      <div
        className={`home-scroll-container${dragging ? " is-dragging" : ""}`}
        ref={container}
      >
        {children}
      </div>
    </section>
  );
}

function cardSubtitle(item: MediaCard): string | undefined {
  if (item.kind === "episode") return item.subtitle;
  return item.productionYear?.toString() ?? item.subtitle;
}

export function HomeMediaCard({
  item,
  landscape = false,
  secondaryText,
  showPlay = false,
}: {
  item: MediaCard;
  landscape?: boolean;
  secondaryText?: string;
  showPlay?: boolean;
}) {
  const imageType =
    landscape && item.backdropImageTag !== undefined ? "backdrop" : "primary";
  const imageTag =
    imageType === "backdrop" ? item.backdropImageTag : item.primaryImageTag;

  return (
    <article className={`home-card-slot${landscape ? " landscape" : ""}`}>
      <Link
        className="home-media-card"
        draggable={false}
        params={{ id: item.itemId }}
        to="/item/$id"
      >
        <span className="home-poster-wrapper">
          <ImageFallback
            alt={item.title}
            className="home-poster-image"
            containerClassName="size-full"
            draggable={false}
            loading="lazy"
            src={mediaImageUrl({
              imageType,
              itemId: item.itemId,
              preset: landscape ? "card" : "poster",
              tag: imageTag,
            })}
          />
          <span aria-hidden="true" className="home-poster-overlay" />
          {showPlay ? (
            <span aria-hidden="true" className="home-play-overlay">
              <PlayCircle fill="currentColor" size={48} />
            </span>
          ) : null}
          {item.communityRating === undefined ? null : (
            <span className="home-rating-badge">
              <Star aria-hidden="true" fill="currentColor" size={12} />
              {item.communityRating.toFixed(1)}
            </span>
          )}
          {item.unplayedItemCount === undefined ||
          item.unplayedItemCount === 0 ? null : (
            <span className="home-episode-badge">
              {item.unplayedItemCount} 集未看
            </span>
          )}
          {item.playedPercentage === undefined ||
          item.playedPercentage <= 0 ? null : (
            <span
              aria-label={`播放进度 ${Math.round(item.playedPercentage)}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(item.playedPercentage)}
              className="home-progress-bar"
              role="progressbar"
            >
              <span
                className="home-progress-fill"
                style={{ width: `${item.playedPercentage}%` }}
              />
            </span>
          )}
        </span>
        <span className="home-card-info">
          <span className="home-card-title" title={item.title}>
            {item.title}
          </span>
          {(secondaryText ?? cardSubtitle(item)) === undefined ? null : (
            <span className="home-card-subtitle">
              {secondaryText ?? cardSubtitle(item)}
            </span>
          )}
        </span>
      </Link>
    </article>
  );
}

export function HomeLibraryCard({ library }: { library: MediaLibrary }) {
  return (
    <article className="home-card-slot landscape">
      <Link
        className="home-media-card"
        draggable={false}
        params={{ libraryId: library.libraryId }}
        search={{ page: 1 }}
        to="/library/$libraryId"
      >
        <span className="home-poster-wrapper">
          <ImageFallback
            alt={library.name}
            className="home-poster-image"
            containerClassName="size-full"
            draggable={false}
            loading="lazy"
            src={mediaImageUrl({
              imageType: "primary",
              itemId: library.libraryId,
              preset: "card",
              tag: library.primaryImageTag,
            })}
          />
          <span aria-hidden="true" className="home-poster-overlay" />
        </span>
        <span className="home-card-info">
          <span className="home-card-title" title={library.name}>
            {library.name}
          </span>
          {library.itemCount === undefined ? null : (
            <span className="home-card-subtitle">
              {library.itemCount} 个项目
            </span>
          )}
        </span>
      </Link>
    </article>
  );
}
