import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** A hoandat.com account that signed in here, known only by the IdP's subject. */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** `sub` of the ID token from auth.hoandat.com: the account's identity. */
  sub: text('sub').notNull().unique(),
  /**
   * Display name, picture URL (https only) and email from the IdP's userinfo, refreshed at every sign-in and shown
   * only to the person in the header's account menu. Null until the first sign-in that returned them.
   */
  name: text('name'),
  picture: text('picture'),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

/** Web sessions: the id is the sha256 of the cookie token, so a database leak hands out no live session. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_account_idx').on(t.accountId)],
);

export const JOB_STATUSES = ['queued', 'rendering', 'done', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** The render queue: queued → rendering → done / failed. The worker claims with FOR UPDATE SKIP LOCKED. */
export const renderJobs = pgTable(
  'render_jobs',
  {
    id: uuid('id').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    templateId: text('template_id').notNull(),
    /** The validated text fields (template field id → text). */
    fields: jsonb('fields').$type<Record<string, string>>().notNull(),
    /** Which of the template's backgrounds (1-based, validated against the catalog); jobs from before the choice: 1. */
    background: integer('background').notNull().default(1),
    /** Video shape ('9:16', '4:5' or '1:1', validated against the catalog); jobs from before the choice: '9:16'. */
    format: text('format').notNull().default('9:16'),
    /** Photos stored for the job under MEDIA_DIR/inputs/<id>/ (deleted once rendered). */
    photoCount: integer('photo_count').notNull(),
    status: text('status').$type<JobStatus>().notNull(),
    /** Stable error code of a failed job (never a stack trace or user data). */
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** After this the video file is deleted (7 days after the job was created). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    outputBytes: integer('output_bytes'),
    durationSeconds: real('duration_seconds'),
    renderMs: integer('render_ms'),
  },
  (t) => [
    check('render_jobs_status_check', sql`${t.status} in ('queued', 'rendering', 'done', 'failed')`),
    check('render_jobs_background_check', sql`${t.background} >= 1`),
    check('render_jobs_format_check', sql`${t.format} in ('9:16', '4:5', '1:1')`),
    index('render_jobs_account_created_idx').on(t.accountId, t.createdAt),
    index('render_jobs_queue_idx').on(t.status, t.createdAt),
    // One queued or rendering job per account, enforced by the database so two quick clicks cannot both pass.
    uniqueIndex('render_jobs_one_active_per_account').on(t.accountId).where(sql`${t.status} in ('queued', 'rendering')`),
  ],
);

export type RenderJob = typeof renderJobs.$inferSelect;
