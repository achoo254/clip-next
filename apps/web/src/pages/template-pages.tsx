import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { isTemplateId, templateById, thumbnailPath, type TemplateSpec } from '@clip/templates';
import { brand } from '../brand';
import { useI18n } from '../i18n';
import { TEMPLATE_BASE } from '../preview/composition-doc';
import {
  createPath,
  relatedTemplates,
  templatePageDescription,
  templatePagePath,
  templatePageTitle,
  templatesByOccasion,
  templatesIndexDescription,
  templatesIndexTitle,
  TEMPLATES_PATH,
} from '../seo/template-pages';
import { NotFound } from './not-found';

function useTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${brand.appName}`;
  }, [title]);
}

function TemplateCard({ spec }: { readonly spec: TemplateSpec }): ReactNode {
  const { locale } = useI18n();
  return (
    <li>
      <Link className="template-card" to={templatePagePath(spec)} data-id={`template-page-${spec.id}`}>
        <img className="template-thumb" src={`${TEMPLATE_BASE}${thumbnailPath(spec)}`} width="240" height="360" alt="" loading="lazy" />
        <b>{spec.name[locale]}</b>
      </Link>
    </li>
  );
}

/** `/mau`: every template by occasion, each linking to its own page. */
export function TemplatesIndexPage(): ReactNode {
  const { t, locale } = useI18n();
  useTitle(templatesIndexTitle(locale));
  return (
    <div className="stack-lg" data-id="templates-index">
      <section className="stack">
        <h1>{templatesIndexTitle(locale)}</h1>
        <p className="lead">{templatesIndexDescription(locale)}</p>
      </section>
      {templatesByOccasion(locale).map((group) => (
        <section key={group.occasion} className="stack" aria-labelledby={`occasion-${group.occasion}`}>
          <h2 id={`occasion-${group.occasion}`}>{group.name}</h2>
          <ul className="template-cards">
            {group.templates.map((spec) => (
              <TemplateCard key={spec.id} spec={spec} />
            ))}
          </ul>
        </section>
      ))}
      <p>
        <Link className="btn btn-primary btn-lg" to="/tao" data-id="templates-index-start">
          {t('intro.start')}
        </Link>
      </p>
    </div>
  );
}

/** `/mau/<template>`: what the template is, a picture of it, and the button that opens it on the create page. */
export function TemplatePage(): ReactNode {
  const { id } = useParams();
  return isTemplateId(id) ? <TemplateLanding spec={templateById(id)} /> : <NotFound />;
}

function TemplateLanding({ spec }: { readonly spec: TemplateSpec }): ReactNode {
  const { t, locale } = useI18n();
  const related = relatedTemplates(spec);
  useTitle(templatePageTitle(spec, locale));
  return (
    <div className="stack-lg" data-id="template-page">
      <p className="muted small">
        <Link to={TEMPLATES_PATH}>{t('templates.all')}</Link>
      </p>
      <section className="template-landing">
        <img className="template-thumb template-landing-thumb" src={`${TEMPLATE_BASE}${thumbnailPath(spec)}`} width="240" height="360" alt="" />
        <div className="stack">
          <h1>{templatePageTitle(spec, locale)}</h1>
          <p className="lead">{templatePageDescription(spec, locale)}</p>
          <p className="muted">{t('create.seconds', { seconds: spec.durationSeconds })}</p>
          <p>
            <Link className="btn btn-primary btn-lg" to={createPath(spec)} data-id="template-page-start">
              {t('templates.make')}
            </Link>
          </p>
        </div>
      </section>
      <section className="stack" aria-labelledby="template-how">
        <h2 id="template-how">{t('intro.how')}</h2>
        <ol className="steps">
          <li>{t('intro.step1')}</li>
          <li>{t('intro.step2')}</li>
          <li>{t('intro.step3')}</li>
        </ol>
      </section>
      {related.length > 0 ? (
        <section className="stack" aria-labelledby="template-related">
          <h2 id="template-related">{t('templates.related')}</h2>
          <ul className="template-cards">
            {related.map((other) => (
              <TemplateCard key={other.id} spec={other} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
