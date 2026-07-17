import type { MediaCard, MediaUserState } from "@newemby/contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function updateValue(
  value: unknown,
  item: MediaCard,
  state: Partial<MediaUserState>,
): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const updated = updateValue(entry, item, state);
      if (updated !== entry) changed = true;
      return updated;
    });
    return changed ? next : value;
  }
  if (!isRecord(value)) return value;

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    let updated = updateValue(entry, item, state);
    if (
      key === "favoriteItems" &&
      Array.isArray(updated) &&
      state.isFavorite !== undefined
    ) {
      if (state.isFavorite) {
        if (
          !updated.some(
            (candidate) =>
              isRecord(candidate) && candidate.itemId === item.itemId,
          )
        )
          updated = [{ ...item, ...state, isFavorite: true }, ...updated];
      } else {
        updated = updated.filter(
          (candidate) =>
            !isRecord(candidate) || candidate.itemId !== item.itemId,
        );
      }
    }
    if (key === "resumeItems" && Array.isArray(updated)) {
      if (
        state.isPlayed === true ||
        (state.isPlayed === false && state.playbackPositionSeconds === 0)
      ) {
        updated = updated.filter(
          (candidate) =>
            !isRecord(candidate) || candidate.itemId !== item.itemId,
        );
      } else if (
        state.isPlayed === false &&
        (state.playbackPositionSeconds ?? 0) > 0 &&
        !updated.some(
          (candidate) =>
            isRecord(candidate) && candidate.itemId === item.itemId,
        )
      ) {
        updated = [{ ...item, ...state, isPlayed: false }, ...updated];
      }
    }
    next[key] = updated;
    if (updated !== entry) changed = true;
  }

  if (value.itemId === item.itemId) {
    for (const key of [
      "isFavorite",
      "isPlayed",
      "playbackPositionSeconds",
      "playedPercentage",
    ] as const) {
      if (state[key] !== undefined && value[key] !== state[key]) {
        next[key] = state[key];
        changed = true;
      }
    }
  }
  return changed ? next : value;
}

export function updateMediaStateCache<T>(
  value: T,
  item: MediaCard,
  state: Partial<MediaUserState>,
): T {
  return updateValue(value, item, state) as T;
}
