import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { MAX_DURATION_SECONDS, TEMPLATES, thumbnailPath } from '@clip/templates';
import { TEMPLATE_BASE } from '../preview/composition-doc';
import { signInUrl } from '../api';
import { useAccount } from '../account';
import { brand } from '../brand';
import { useI18n } from '../i18n';
import { SignInTicket } from '../sign-in-ticket';

const DAILY_LIMIT = 5;
const FEATURES = ['pick', 'type', 'render', 'free'] as const;

/**
 * The page people see before signing in: the marquee hero with the mascot and the sign-in ticket (one call to
 * action), the templates as a wall of posters (each opens the create page, where the preview works signed out), and
 * how it works as the frames of a film strip.
 */
export function IntroPage(): ReactNode {
  const { t, locale } = useI18n();
  const { me } = useAccount();
  const canSignIn = me?.signInAvailable === true;
  return (
    <div className="intro stack-lg" data-id="intro">
      <section className={canSignIn ? 'hero hero-split' : 'hero'} data-id="hero">
        <div className="hero-copy">
          <p className="marquee-sign">{brand.appName}</p>
          <h1 className="hero-title">{t('intro.title')}</h1>
          <p className="lead">{t('intro.lead')}</p>
        </div>
        <div className="hero-aside">
          <img className="hero-mascot" src="/clip-mascot-384.webp" width="192" height="192" alt="" />
          {canSignIn ? <SignInTicket signInHref={signInUrl('/tao', locale)} title={t('signIn.title')} description={t('signIn.lead')} /> : null}
        </div>
      </section>

      <section className="poster-wall stack" aria-labelledby="intro-templates">
        <div className="section-head">
          <h2 id="intro-templates">{t('intro.templates')}</h2>
          <p className="muted">{t('intro.count', { count: TEMPLATES.length })}</p>
        </div>
        <ul className="template-cards">
          {TEMPLATES.map((tpl) => (
            <li key={tpl.id}>
              <Link className="template-card" to={`/tao?t=${tpl.id}`} data-id={`intro-template-${tpl.id}`}>
                <img className="template-thumb" src={`${TEMPLATE_BASE}${thumbnailPath(tpl)}`} width="240" height="360" alt="" loading="lazy" />
                <b>{tpl.name[locale]}</b>
                <span className="muted small">{tpl.description[locale]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" id="how" data-id="features" aria-labelledby="intro-how">
        <h2 id="intro-how">{t('intro.how')}</h2>
        <ol className="film-strip">
          {FEATURES.map((id) => (
            <li key={id} className="film-frame" data-id={`feature-${id}`}>
              <h3 className="film-frame-title">{t(`features.${id}.title`)}</h3>
              <p className="film-frame-text">{t(`features.${id}.text`, { limit: DAILY_LIMIT, seconds: MAX_DURATION_SECONDS })}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
