/** Vietnam is UTC+7 all year (no daylight saving time). */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the Vietnamese calendar day containing `now` (00:00 Asia/Saigon), as an instant. */
export function vietnamDayStart(now: Date): Date {
  const local = now.getTime() + VIETNAM_OFFSET_MS;
  return new Date(local - (((local % DAY_MS) + DAY_MS) % DAY_MS) - VIETNAM_OFFSET_MS);
}

/** Start of the next Vietnamese calendar day: when the daily render allowance comes back. */
export function nextVietnamDayStart(now: Date): Date {
  return new Date(vietnamDayStart(now).getTime() + DAY_MS);
}
