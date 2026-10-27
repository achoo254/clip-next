import type { ReactNode } from 'react';
import { VIDEO_FORMATS, type VideoFormat } from '@clip/templates';
import { useI18n } from '../i18n';

interface Props {
  readonly value: VideoFormat;
  onChange(format: VideoFormat): void;
}

/** The video shape: vertical 9:16 (stories, Shorts), 4:5 and square (feed posts). */
export function FormatPicker({ value, onChange }: Props): ReactNode {
  const { t } = useI18n();
  return (
    <div className="field" role="group" aria-labelledby="format-label" data-id="format">
      <span id="format-label" className="label">
        {t('create.format')}
      </span>
      <div className="chips">
        {VIDEO_FORMATS.map((format) => (
          <button key={format} type="button" className="chip" aria-pressed={format === value} onClick={() => onChange(format)} data-id={`format-${format}`}>
            {t(`create.format.${format}`)}
          </button>
        ))}
      </div>
      <p className="muted small">{t('create.formatHint')}</p>
    </div>
  );
}
