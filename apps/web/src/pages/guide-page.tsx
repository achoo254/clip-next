import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { templateById, thumbnailPath } from '@clip/templates';
import { brand } from '../brand';
import { TEMPLATE_BASE } from '../preview/composition-doc';
import { GUIDE_IDS, GUIDES, guideStartPath, type Guide } from '../seo/guide-pages';
import { createPath, TEMPLATES_PATH } from '../seo/template-pages';

/**
 * A guide page (/lam-video-sinh-nhat-tu-anh, /lam-video-doc-tu-anh, /video-chuc-tet-2027): what the templates do,
 * posters opening /tao on each, three steps, questions, the call to action into /tao and links to the other guides.
 * Vietnamese whatever the visitor's language (seo/guide-pages.ts). The build renders this same component to HTML for
 * crawlers (vite-seo.ts), so it reads no context besides the router and touches no browser API while rendering.
 */
export function GuidePage({ guide }: { readonly guide: Guide }): ReactNode {
  useEffect(() => {
    document.title = `${guide.title} · ${brand.appName}`;
  }, [guide.title]);
  const start = guideStartPath(guide);
  const others = GUIDE_IDS.filter((id) => id !== guide.id).map((id) => GUIDES[id]);
  return (
    <article className="guide stack-lg" lang="vi" data-id={`guide-${guide.id}`}>
      <header className="stack" data-id="guide-head">
        <p className="guide-eyebrow">{guide.eyebrow}</p>
        <h1>{guide.heading}</h1>
        <p className="lead">{guide.lede}</p>
        <p>
          <Link className="btn btn-primary btn-lg" to={start} data-id="guide-cta-top">
            {guide.cta}
          </Link>
        </p>
      </header>

      <section className="stack" aria-labelledby="guide-picks-title" data-id="guide-picks">
        <h2 id="guide-picks-title">{guide.picksHeading}</h2>
        <ul className="template-cards">
          {guide.picks.map((id) => {
            const spec = templateById(id);
            return (
              <li key={id}>
                <Link className="template-card" to={createPath(spec)} data-id={`guide-pick-${id}`}>
                  <img className="template-thumb" src={`${TEMPLATE_BASE}${thumbnailPath(spec)}`} width="240" height="360" alt="" loading="lazy" />
                  <b>{spec.name.vi}</b>
                  <span className="muted small">{spec.description.vi}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {guide.sections.map((section, index) => (
        <section key={section.heading} className="prose" data-id={`guide-section-${index + 1}`}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.list ? (
            <ul className="guide-list">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <section className="prose" aria-labelledby="guide-steps-title" data-id="guide-steps">
        <h2 id="guide-steps-title">Ba bước là xong</h2>
        <ol className="steps">
          {guide.steps.map((step, index) => (
            <li key={step.title} data-id={`guide-step-${index + 1}`}>
              <span>
                <b>{step.title}.</b> {step.body}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="prose" aria-labelledby="guide-faq-title" data-id="guide-faq">
        <h2 id="guide-faq-title">Câu hỏi thường gặp</h2>
        <dl className="guide-faq">
          {guide.faq.map((item) => (
            <div key={item.question} className="guide-faq-item">
              <dt>{item.question}</dt>
              <dd>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="stack" data-id="guide-end">
        <p>
          <Link className="btn btn-primary btn-lg" to={start} data-id="guide-cta">
            {guide.cta}
          </Link>
        </p>
        <p className="muted small">Làm thử chưa cần tài khoản. Đăng ký miễn phí khi bạn bấm tạo video.</p>
      </section>

      <nav className="stack" aria-labelledby="guide-related-title" data-id="guide-related">
        <h2 id="guide-related-title">Gợi ý khác</h2>
        <ul className="guide-links">
          {others.map((other) => (
            <li key={other.id}>
              <Link to={other.path} data-id={`guide-related-${other.id}`}>
                {other.linkLabel}
              </Link>
            </li>
          ))}
          <li>
            <Link to={TEMPLATES_PATH} data-id="guide-related-all">
              Xem tất cả mẫu video
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}
