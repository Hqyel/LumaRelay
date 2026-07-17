import type { MediaCard } from "@newemby/contracts";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { HomeMediaCard } from "./home-media.js";
import {
  mediaGridColumnCount,
  mediaGridRowCount,
  mediaGridRowEstimate,
} from "./media-grid-layout.js";

interface GridLayout {
  columns: number;
  scrollMargin: number;
  width: number;
}

export function VirtualMediaBrowserGrid({
  items,
  label,
  secondaryText,
}: {
  items: MediaCard[];
  label: string;
  secondaryText?: (item: MediaCard) => string | undefined;
}) {
  const container = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<GridLayout>({
    columns: 1,
    scrollMargin: 0,
    width: 0,
  });

  useLayoutEffect(() => {
    const element = container.current;
    if (element === null) return;

    function measure() {
      if (element === null) return;
      const bounds = element.getBoundingClientRect();
      const next: GridLayout = {
        columns: mediaGridColumnCount(bounds.width, window.innerWidth),
        scrollMargin: bounds.top + window.scrollY,
        width: bounds.width,
      };
      setLayout((current) =>
        current.columns === next.columns &&
        current.scrollMargin === next.scrollMargin &&
        current.width === next.width
          ? current
          : next,
      );
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const rowCount = mediaGridRowCount(items.length, layout.columns);
  const getItemKey = useCallback(
    (index: number) => items[index * layout.columns]?.itemId ?? index,
    [items, layout.columns],
  );
  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: rowCount,
    estimateSize: () =>
      mediaGridRowEstimate(layout.width, layout.columns, window.innerWidth),
    getItemKey,
    overscan: 1,
    scrollMargin: layout.scrollMargin,
    useFlushSync: false,
  });

  return (
    <section
      aria-label={label}
      className="media-browser-virtual-grid"
      data-virtual-row-count={rowCount}
      ref={container}
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const start = virtualRow.index * layout.columns;
        const rowItems = items.slice(start, start + layout.columns);
        return (
          <div
            className={`media-browser-grid-row${
              virtualRow.index === rowCount - 1 ? " is-last" : ""
            }`}
            data-index={virtualRow.index}
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
              transform: `translateY(${virtualRow.start - layout.scrollMargin}px)`,
            }}
          >
            {rowItems.map((item, columnIndex) => (
              <HomeMediaCard
                item={item}
                key={item.itemId}
                priority={start + columnIndex === 0}
                secondaryText={secondaryText?.(item)}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}
