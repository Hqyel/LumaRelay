const DESKTOP_GAP = 20;
const DESKTOP_MIN_CARD_WIDTH = 160;
const MOBILE_BREAKPOINT = 640;
const MOBILE_COLUMNS = 2;
const MOBILE_GAP = 12;
const CARD_INFO_HEIGHT = 58;

export function mediaGridColumnCount(
  width: number,
  viewportWidth: number,
): number {
  if (viewportWidth < MOBILE_BREAKPOINT) return MOBILE_COLUMNS;
  return Math.max(
    1,
    Math.floor(
      (Math.max(0, width) + DESKTOP_GAP) /
        (DESKTOP_MIN_CARD_WIDTH + DESKTOP_GAP),
    ),
  );
}

export function mediaGridRowCount(itemCount: number, columns: number): number {
  return Math.ceil(Math.max(0, itemCount) / Math.max(1, columns));
}

export function mediaGridRowEstimate(
  width: number,
  columns: number,
  viewportWidth: number,
): number {
  const gap = viewportWidth < MOBILE_BREAKPOINT ? MOBILE_GAP : DESKTOP_GAP;
  const cardWidth = (width - gap * Math.max(0, columns - 1)) / columns;
  return Math.max(1, cardWidth) * 1.5 + CARD_INFO_HEIGHT + gap;
}
