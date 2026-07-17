import type { MediaCard } from "@newemby/contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function updateValue(
  value: unknown,
  item: MediaCard,
  favorite: boolean,
): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const updated = updateValue(entry, item, favorite);
      if (updated !== entry) changed = true;
      return updated;
    });
    return changed ? next : value;
  }
  if (!isRecord(value)) return value;

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    let updated = updateValue(entry, item, favorite);
    if (key === "favoriteItems" && Array.isArray(updated)) {
      if (favorite) {
        if (
          !updated.some(
            (candidate) =>
              isRecord(candidate) && candidate.itemId === item.itemId,
          )
        )
          updated = [{ ...item, isFavorite: true }, ...updated];
      } else {
        updated = updated.filter(
          (candidate) =>
            !isRecord(candidate) || candidate.itemId !== item.itemId,
        );
      }
    }
    next[key] = updated;
    if (updated !== entry) changed = true;
  }

  if (value.itemId === item.itemId && value.isFavorite !== favorite) {
    next.isFavorite = favorite;
    changed = true;
  }
  return changed ? next : value;
}

export function updateFavoriteCache<T>(
  value: T,
  item: MediaCard,
  favorite: boolean,
): T {
  return updateValue(value, item, favorite) as T;
}
