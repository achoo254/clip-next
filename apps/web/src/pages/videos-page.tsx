import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { isTemplateId, templateById } from '@clip/templates';
import { ApiError, downloadUrl, listJobs, signInUrl, videoUrl, type Job, type JobList } from '../api';
import { useAccount } from '../account';
import { formatTime } from '../format-time';
import { useI18n } from '../i18n';
import { useHere } from '../layout';
import { SignInTicket } from '../sign-in-ticket';

/** Job status is polled this often while a job is queued or rendering. */
const POLL_MS = 3_000;

function ShareButton({ job }: { readonly job: Job }): ReactNode {
  const { t } = useI18n();
  const [note, setNote] = useState<string | null>(null);
  const share = async (): Promise<void> => {
    setNote(null);
    try {
      const res = await fetch(videoUrl(job.id), { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`video ${res.status}`);
      const file = new File([await res.blob()], `clip-${job.id.slice(0, 8)}.mp4`, { type: 'video/mp4' });
      if (!navigator.canShare?.({ files: [file] })) {
        setNote(t('videos.shareFallback'));
        return;
      }
      await navigator.share({ files: [file] });
    } catch (error) {
      // Closing the share sheet is not an error worth showing.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNote(t('videos.shareFallback'));
    }
  };
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => void share()} data-id={`share-${job.id}`}>
        {t('videos.share')}
      </button>
      {note ? <p className="muted small">{note}</p> : null}
    </>
  );
}

function JobCard({ job }: { readonly job: Job }): ReactNode {
  const { t, locale } = useI18n();
  const name = isTemplateId(job.templateId) ? templateById(job.templateId).name[locale] : job.templateId;
  return (
    <li className="card job" data-id={`job-${job.id}`}>
      <div className="job-head">
        <b>{name}</b>
        <span className={`badge badge-${job.status}`}>{t(`status.${job.status}`)}</span>
      </div>
      <p className="muted small">{t('videos.created', { time: formatTime(job.createdAt, locale) })}</p>
      {job.status === 'done' && !job.expired ? (
        <>
          {/* The videos carry music and the person's own on-screen text, no speech: there is nothing to caption. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="job-video" src={videoUrl(job.id)} controls playsInline preload="metadata" />
          <div className="job-actions">
            <ShareButton job={job} />
            <a className="btn btn-secondary" href={downloadUrl(job.id)} download data-id={`download-${job.id}`}>
              {t('videos.download')}
            </a>
          </div>
          <p className="muted small">{t('videos.expires', { time: formatTime(job.expiresAt, locale) })}</p>
        </>
      ) : null}
      {job.status === 'done' && job.expired ? <p className="muted small">{t('videos.expired')}</p> : null}
      {job.status === 'failed' ? <p className="muted small">{t(job.error?.startsWith('voice-') ? 'videos.failedVoice' : 'videos.failedNote')}</p> : null}
    </li>
  );
}

export function VideosPage(): ReactNode {
  const { t, locale } = useI18n();
  const { me } = useAccount();
  const here = useHere();
  const [list, setList] = useState<JobList | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (): Promise<JobList | null> => {
    try {
      const next = await listJobs();
      setList(next);
      setFailed(false);
      return next;
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) setFailed(true);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!me?.signedIn) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let live = true;
    const tick = async (): Promise<void> => {
      const next = await load();
      const pending = next?.jobs.some((j) => j.status === 'queued' || j.status === 'rendering') ?? false;
      if (live && pending) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [me?.signedIn, load]);

  if (me && !me.signedIn) {
    return (
      <div className="stack">
        <h1>{t('videos.title')}</h1>
        <SignInTicket signInHref={signInUrl(here, locale)} title={t('videos.signIn')} />
      </div>
    );
  }
  return (
    <div className="stack" data-id="videos">
      <h1>{t('videos.title')}</h1>
      {list ? <p className="muted">{t('videos.usage', { used: list.limits.usedToday, limit: list.limits.perDay })}</p> : null}
      {failed ? <p className="alert alert-error">{t('error.generic')}</p> : null}
      {list && list.jobs.length === 0 ? <p>{t('videos.empty')}</p> : null}
      <ul className="job-list">{list?.jobs.map((job) => <JobCard key={job.id} job={job} />)}</ul>
    </div>
  );
}
