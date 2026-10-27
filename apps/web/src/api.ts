import type { TemplateId } from '@clip/templates';

/** A refused API call: the server's stable error code plus its extra fields (limit, resetAt, field…). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Readonly<Record<string, unknown>>,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export type JobStatus = 'queued' | 'rendering' | 'done' | 'failed';

export interface Job {
  readonly id: string;
  readonly templateId: string;
  readonly status: JobStatus;
  readonly error: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
  readonly expiresAt: string;
  readonly expired: boolean;
  readonly durationSeconds: number | null;
}

export interface JobList {
  readonly jobs: readonly Job[];
  readonly limits: { readonly perDay: number; readonly usedToday: number; readonly resetAt: string };
}

export interface Me {
  readonly signedIn: boolean;
  readonly signInAvailable: boolean;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const extra = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    throw new ApiError(res.status, typeof extra.error === 'string' ? extra.error : 'generic', extra);
  }
  return body as T;
}

export const getMe = (): Promise<Me> => call<Me>('/api/me');

export const signOut = (): Promise<null> => call<null>('/auth/logout', { method: 'POST' });

export const listJobs = (): Promise<JobList> => call<JobList>('/api/jobs');

export function createJob(
  templateId: TemplateId,
  fields: Readonly<Record<string, string>>,
  background: number,
  photos: readonly File[],
): Promise<{ job: Job }> {
  const form = new FormData();
  form.set('templateId', templateId);
  form.set('fields', JSON.stringify(fields));
  form.set('background', String(background));
  for (const photo of photos) form.append('photos', photo, photo.name);
  return call<{ job: Job }>('/api/jobs', { method: 'POST', body: form });
}

/** Sign-in page of the account service, coming back to `returnTo`. */
export function signInUrl(returnTo: string, lang: string): string {
  return `/auth/login?${new URLSearchParams({ return: returnTo, lang }).toString()}`;
}

export const videoUrl = (id: string): string => `/api/jobs/${encodeURIComponent(id)}/video`;
export const downloadUrl = (id: string): string => `/api/jobs/${encodeURIComponent(id)}/download`;
