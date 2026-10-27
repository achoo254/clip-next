import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../i18n';

export function NotFound(): ReactNode {
  const { t } = useI18n();
  return (
    <div className="stack">
      <h1>{t('notFound.title')}</h1>
      <Link to="/">{t('notFound.back')}</Link>
    </div>
  );
}
