import { useState, type ReactNode } from 'react';
import { OCCASION_NAMES, OCCASIONS, TEMPLATES, thumbnailPath, type Occasion, type TemplateId } from '@clip/templates';
import { TEMPLATE_BASE } from '../preview/composition-doc';
import { useI18n } from '../i18n';

type Filter = Occasion | 'all';

interface Props {
  readonly value: TemplateId;
  onChange(id: TemplateId): void;
}

/**
 * The templates as a grid of thumbnails (each a small copy of the template's AI-drawn background), filtered by
 * occasion. A radio group underneath: Tab reaches it, the arrow keys move between templates.
 */
export function TemplatePicker({ value, onChange }: Props): ReactNode {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const shown = TEMPLATES.filter((tpl) => filter === 'all' || tpl.occasions.includes(filter) || tpl.id === value);
  const chips: readonly Filter[] = ['all', ...OCCASIONS];
  return (
    <div className="picker" data-id="template-picker">
      <div className="chips" role="group" aria-label={t('create.filter')}>
        {chips.map((chip) => (
          <button key={chip} type="button" className="chip" aria-pressed={chip === filter} onClick={() => setFilter(chip)} data-id={`filter-${chip}`}>
            {chip === 'all' ? t('create.filterAll') : OCCASION_NAMES[chip][locale]}
          </button>
        ))}
      </div>
      <fieldset className="template-grid">
        <legend className="label">{t('create.template')}</legend>
        {shown.map((tpl) => (
          <label key={tpl.id} className="template-tile" data-id={`template-${tpl.id}`}>
            <input
              type="radio"
              name="template"
              value={tpl.id}
              className="visually-hidden"
              checked={tpl.id === value}
              onChange={() => onChange(tpl.id)}
            />
            <img className="template-thumb" src={`${TEMPLATE_BASE}${thumbnailPath(tpl)}`} width="240" height="360" alt="" loading="lazy" />
            <span className="template-name">
              <b>{tpl.name[locale]}</b>
              <span className="muted small block">{t('create.seconds', { seconds: tpl.durationSeconds })}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
