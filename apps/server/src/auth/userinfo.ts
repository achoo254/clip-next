// What Clip keeps of the person besides `sub`: the display name, picture and email the IdP's userinfo endpoint
// returns for scope `openid profile email`, shown only to that person in the header's account menu.

/** Name, picture URL and email of an account; any of them may be missing. */
export interface AccountProfile {
  readonly name: string | null;
  readonly picture: string | null;
  readonly email: string | null;
}

export const EMPTY_PROFILE: AccountProfile = { name: null, picture: null, email: null };

const MAX_NAME = 200;
const MAX_PICTURE = 2048;
const MAX_EMAIL = 320;

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name === '' ? null : name.slice(0, MAX_NAME);
}

/** Only an https URL: the browser loads it directly, so anything else is dropped. */
function cleanPicture(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_PICTURE) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function cleanEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  return email.length <= MAX_EMAIL && /^[^\s@]+@[^\s@]+$/.test(email) ? email : null;
}

/**
 * The profile in a userinfo response, or null when it is not one for `sub` (OIDC Core 5.3.2: the userinfo `sub`
 * must match the ID token's). The name falls back to `preferred_username`.
 */
export function profileFromUserinfo(body: unknown, sub: string): AccountProfile | null {
  if (typeof body !== 'object' || body === null) return null;
  const claims = body as Record<string, unknown>;
  if (claims.sub !== sub) return null;
  return {
    name: cleanName(claims.name) ?? cleanName(claims.preferred_username),
    picture: cleanPicture(claims.picture),
    email: cleanEmail(claims.email),
  };
}

/** Asks the IdP's userinfo endpoint with the access token of the code exchange. */
export async function fetchProfile(endpoint: string, accessToken: string, sub: string): Promise<AccountProfile | null> {
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  return profileFromUserinfo(await res.json().catch(() => null), sub);
}
