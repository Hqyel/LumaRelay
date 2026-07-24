import { ImageFallback } from "@lumarelay/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { mediaImageUrl } from "../api.js";
import { mediaSearchQuery } from "../media-query.js";

export function HeaderSearch() {
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const results = useQuery(mediaSearchQuery(searchTerm));

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        close();
    }

    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, []);

  function show() {
    setOpen(true);
    window.setTimeout(() => input.current?.focus());
  }

  function close(restoreFocus = false) {
    setOpen(false);
    setTerm("");
    setSearchTerm("");
    if (restoreFocus) window.setTimeout(() => trigger.current?.focus());
  }

  const media =
    results.data === undefined
      ? []
      : [...results.data.movies, ...results.data.series].slice(0, 10);

  return (
    <div className="header-search" ref={container}>
      {open ? (
        <div className="header-search-expanded">
          <Search aria-hidden="true" className="header-search-icon" size={16} />
          <input
            aria-controls="header-search-results"
            aria-expanded={searchTerm !== ""}
            aria-label="搜索电影或剧集"
            aria-autocomplete="list"
            autoComplete="off"
            onChange={(event) => setTerm(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") close(true);
            }}
            placeholder="搜索电影、剧集…"
            ref={input}
            role="combobox"
            spellCheck={false}
            type="search"
            value={term}
          />
          {term === "" ? null : (
            <button
              aria-label="清除搜索"
              className="header-search-clear"
              onClick={() => {
                setTerm("");
                input.current?.focus();
              }}
              type="button"
            >
              <X aria-hidden="true" size={15} />
            </button>
          )}
        </div>
      ) : (
        <button
          aria-expanded="false"
          aria-label="打开全局搜索"
          className="header-search-trigger"
          onClick={show}
          ref={trigger}
          title="搜索"
          type="button"
        >
          <Search aria-hidden="true" size={17} />
        </button>
      )}

      {!open || searchTerm === "" ? null : (
        <div
          aria-live="polite"
          className="header-search-dropdown"
          id="header-search-results"
        >
          {results.isPending ? (
            <div className="header-search-state">
              <span className="header-search-spinner" />
              搜索中…
            </div>
          ) : results.isError ? (
            <div className="header-search-state">搜索暂时不可用</div>
          ) : media.length === 0 ? (
            <div className="header-search-state">未找到相关电影或剧集</div>
          ) : (
            <div className="header-search-results">
              {media.map((item) => (
                <Link
                  className="header-search-result"
                  key={item.itemId}
                  onClick={() => close()}
                  params={{ id: item.itemId }}
                  to="/item/$id"
                >
                  <ImageFallback
                    alt=""
                    className="header-search-poster-image"
                    containerClassName="header-search-poster"
                    height={48}
                    loading="lazy"
                    src={mediaImageUrl({
                      imageType: "primary",
                      itemId: item.itemId,
                      preset: "avatar",
                      tag: item.primaryImageTag,
                    })}
                    width={48}
                  />
                  <span className="header-search-result-info">
                    <strong>{item.title}</strong>
                    <small>
                      {item.productionYear === undefined
                        ? ""
                        : `${item.productionYear} · `}
                      {item.kind === "series" ? "剧集" : "电影"}
                    </small>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="header-search-result-arrow"
                    size={17}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
