/** Present at most 60 frames/s, independent of monitor refresh rate. */
export class FrameBudget {
  next = 0;
  take(now: number) {
    const step = 1000 / 60;
    if (now + 0.5 < this.next) return false;
    this.next =
      this.next && now - this.next < step ? this.next + step : now + step;
    return true;
  }
}

export function renderScale(width: number, height: number, dpr: number) {
  return Math.min(
    dpr,
    1.25,
    Math.sqrt(2_100_000 / Math.max(1, width * height)),
  );
}
