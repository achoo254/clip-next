import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../i18n';

export function NotFound(): ReactNode {
  const { t } = useI18n();
  return (
    <div className="not-found" data-id="not-found">
      <p className="not-found-code" aria-hidden="true">
        404
      </p>
      <h1>{t('notFound.title')}</h1>
      <Link className="btn btn-secondary" to="/">
        {t('notFound.back')}
      </Link>
    </div>
  );
}
