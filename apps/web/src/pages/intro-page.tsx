import { FeatureList, Hero, SignInCard } from '@achoo254/app-shell';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { MAX_DURATION_SECONDS, TEMPLATES, thumbnailPath } from '@clip/templates';
import { TEMPLATE_BASE } from '../preview/composition-doc';
import { signInUrl } from '../api';
import { useAccount } from '../account';
import { brand } from '../brand';
import { useI18n } from '../i18n';
import { SHELL_BRAND } from '../layout';

const DAILY_LIMIT = 5;
const FEATURES = ['pick', 'type', 'render', 'free'] as const;

/**
 * The page people see before signing in: the shared hero and sign-in card (one call to action), the templates
 * (each opens the create page, where the preview works signed out), and how it works.
 */
export function IntroPage(): ReactNode {
  const { t, locale } = useI18n();
  const { me } = useAccount();
  const canSignIn = me?.signInAvailable === true;
  return (
    <div className="intro stack-lg" data-id="intro">
      <Hero
        eyebrow={brand.appName}
        title={t('intro.title')}
        lede={t('intro.lead')}
        aside={
          canSignIn ? (
            <SignInCard
              brand={SHELL_BRAND}
              locale={locale}
              signInHref={signInUrl('/tao', locale)}
              title={t('signIn.title')}
              description={t('signIn.lead')}
              headingLevel={2}
            />
          ) : undefined
        }
      />

      <section className="stack" aria-labelledby="intro-templates">
        <h2 id="intro-templates">{t('intro.templates')}</h2>
        <p className="muted">{t('intro.count', { count: TEMPLATES.length })}</p>
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

      <FeatureList
        id="how"
        title={t('intro.how')}
        items={FEATURES.map((id) => ({
          id,
          title: t(`features.${id}.title`),
          description: t(`features.${id}.text`, { limit: DAILY_LIMIT, seconds: MAX_DURATION_SECONDS }),
        }))}
      />
    </div>
  );
}
