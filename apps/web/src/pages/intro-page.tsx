import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { MAX_DURATION_SECONDS, TEMPLATES } from '@clip/templates';
import { signInUrl } from '../api';
import { useAccount } from '../account';
import { brand } from '../brand';
import { useI18n } from '../i18n';

const DAILY_LIMIT = 5;

/** The page people see before signing in: what the app does, the templates, the limits. */
export function IntroPage(): ReactNode {
  const { t, locale } = useI18n();
  const { me } = useAccount();
  return (
    <div className="intro stack-lg" data-id="intro">
      <section className="hero">
        <img className="hero-mark" src="/clip-mark-128.webp" width="96" height="96" alt="" aria-hidden="true" />
        <div className="stack">
          <p className="eyebrow">{brand.appName}</p>
          <h1>{t('intro.title')}</h1>
          <p className="lead">{t('intro.lead')}</p>
          <div className="row">
            <Link className="btn btn-primary btn-lg" to="/tao" data-id="intro-start">
              {t('intro.start')}
            </Link>
            {me && !me.signedIn ? (
              <a className="btn btn-secondary btn-lg" href={signInUrl('/tao', locale)} data-id="intro-sign-in">
                {t('intro.signIn')}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="stack" aria-labelledby="intro-templates">
        <h2 id="intro-templates">{t('intro.templates')}</h2>
        <ul className="template-cards">
          {TEMPLATES.map((tpl) => (
            <li key={tpl.id} className="card template-card">
              <h3>{tpl.name[locale]}</h3>
              <p className="muted">{tpl.description[locale]}</p>
              <Link to={`/tao?t=${tpl.id}`} data-id={`intro-template-${tpl.id}`}>
                {t('intro.start')} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-labelledby="intro-how">
        <h2 id="intro-how">{t('intro.how')}</h2>
        <ol className="steps">
          <li>{t('intro.step1')}</li>
          <li>{t('intro.step2')}</li>
          <li>{t('intro.step3')}</li>
        </ol>
        <p className="muted">{t('intro.limits', { limit: DAILY_LIMIT, seconds: MAX_DURATION_SECONDS })}</p>
      </section>
    </div>
  );
}
