import { describe, expect, it } from 'vitest';
import { profileFromUserinfo } from './userinfo';

describe('profileFromUserinfo', () => {
  it('keeps the name, an https picture and a plausible email of the same subject', () => {
    expect(
      profileFromUserinfo({ sub: 's1', name: '  Lan\n Anh ', picture: 'https://avatars.githubusercontent.com/u/1?v=4', email: ' lan@example.com ' }, 's1'),
    ).toEqual({ name: 'Lan Anh', picture: 'https://avatars.githubusercontent.com/u/1?v=4', email: 'lan@example.com' });
  });

  it('falls back to preferred_username and drops what is not usable', () => {
    expect(
      profileFromUserinfo({ sub: 's1', name: ' ', preferred_username: 'lan', picture: 'javascript:alert(1)', email: 'not an email' }, 's1'),
    ).toEqual({ name: 'lan', picture: null, email: null });
    expect(profileFromUserinfo({ sub: 's1', picture: 'http://example.com/a.png', name: 42 }, 's1')).toEqual({
      name: null,
      picture: null,
      email: null,
    });
    expect(profileFromUserinfo({ sub: 's1', name: 'x'.repeat(500), picture: `https://e.com/${'a'.repeat(3000)}` }, 's1')).toEqual({
      name: 'x'.repeat(200),
      picture: null,
      email: null,
    });
  });

  it('refuses an answer for another subject or no object at all', () => {
    expect(profileFromUserinfo({ sub: 's2', name: 'Mallory' }, 's1')).toBeNull();
    expect(profileFromUserinfo(null, 's1')).toBeNull();
    expect(profileFromUserinfo('s1', 's1')).toBeNull();
  });
});
