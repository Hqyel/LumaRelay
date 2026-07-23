interface OverflowMarqueeState {
  direction: 1 | -1;
  frame: number;
  holdUntil: number;
  previousTime: number;
}

const overflowMarquees = new WeakMap<HTMLElement, OverflowMarqueeState>();
const END_HOLD_DURATION_MS = 500;
const INITIAL_HOLD_DURATION_MS = 180;
const SCROLL_SPEED_PX_PER_MS = 0.055;

export function stopOverflowMarquee(element: HTMLElement, reset = true): void {
  const state = overflowMarquees.get(element);
  if (state !== undefined) cancelAnimationFrame(state.frame);
  overflowMarquees.delete(element);
  if (reset) element.scrollTo({ behavior: "smooth", left: 0 });
}

export function startOverflowMarquee(element: HTMLElement): void {
  stopOverflowMarquee(element, false);
  if (
    element.scrollWidth <= element.clientWidth ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;

  const initialTime = performance.now();
  const state: OverflowMarqueeState = {
    direction: 1,
    frame: 0,
    holdUntil: initialTime + INITIAL_HOLD_DURATION_MS,
    previousTime: initialTime,
  };

  const step = (time: number) => {
    if (!element.isConnected) {
      overflowMarquees.delete(element);
      return;
    }

    const elapsed = Math.min(time - state.previousTime, 64);
    state.previousTime = time;
    if (time >= state.holdUntil) {
      element.scrollLeft += state.direction * elapsed * SCROLL_SPEED_PX_PER_MS;
      const scrollEnd = element.scrollWidth - element.clientWidth;
      if (state.direction === 1 && element.scrollLeft >= scrollEnd - 0.5) {
        element.scrollLeft = scrollEnd;
        state.direction = -1;
        state.holdUntil = time + END_HOLD_DURATION_MS;
      } else if (state.direction === -1 && element.scrollLeft <= 0.5) {
        element.scrollLeft = 0;
        state.direction = 1;
        state.holdUntil = time + END_HOLD_DURATION_MS;
      }
    }

    state.frame = requestAnimationFrame(step);
  };

  overflowMarquees.set(element, state);
  state.frame = requestAnimationFrame(step);
}
