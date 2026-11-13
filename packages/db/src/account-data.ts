import { eq } from 'drizzle-orm';
import type { Db } from './client';
import { accounts, renderJobs } from './schema';

export interface DeletedAccount {
  readonly accountId: string;
  /** The account's jobs, now gone: their video and photos are deleted by the caller, by these ids. */
  readonly jobIds: readonly string[];
}

/**
 * Deletes everything stored for an IdP subject, in one transaction: the account row (name, picture, email) and, by
 * cascade, its sessions and render jobs (the text it typed). Nothing in Clip is shared between accounts, so nothing is
 * handed over. Null when no account has that `sub` (never signed in here, or already deleted).
 */
export async function deleteAccountData(db: Db, sub: string): Promise<DeletedAccount | null> {
  return db.transaction(async (tx) => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.sub, sub)).for('update');
    if (!account) return null;
    const jobs = await tx.select({ id: renderJobs.id }).from(renderJobs).where(eq(renderJobs.accountId, account.id));
    await tx.delete(accounts).where(eq(accounts.id, account.id));
    return { accountId: account.id, jobIds: jobs.map((j) => j.id) };
  });
}
