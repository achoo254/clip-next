import { describe, expect, it } from 'vitest';
import { nextVietnamDayStart, vietnamDayStart } from './vietnam-day';

describe('Vietnamese calendar day', () => {
  it('starts at 00:00 Asia/Saigon (17:00 UTC the day before)', () => {
    expect(vietnamDayStart(new Date('2026-10-26T03:00:00Z'))).toEqual(new Date('2026-10-25T17:00:00Z'));
    expect(vietnamDayStart(new Date('2026-10-26T16:59:59Z'))).toEqual(new Date('2026-10-25T17:00:00Z'));
    expect(vietnamDayStart(new Date('2026-10-26T17:00:00Z'))).toEqual(new Date('2026-10-26T17:00:00Z'));
    expect(nextVietnamDayStart(new Date('2026-10-26T03:00:00Z'))).toEqual(new Date('2026-10-26T17:00:00Z'));
  });
});
