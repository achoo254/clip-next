import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  composeTemplateHtml,
  compositionVariables,
  FORMAT_SIZES,
  templateById,
  type LayoutId,
  type TemplateId,
  type VideoFormat,
} from '@clip/templates';
import { formatCues, type VoiceTimeline } from '@clip/templates/voice';
import chart from '@clip/templates/project/layouts/chart.html?raw';
import greeting from '@clip/templates/project/layouts/greeting.html?raw';
import quick from '@clip/templates/project/layouts/quick.html?raw';
import quote from '@clip/templates/project/layouts/quote.html?raw';
import { useI18n } from '../i18n';
import { previewDocument, RUNTIME_SRC } from './composition-doc';

const LAYOUT_HTML: Readonly<Record<LayoutId, string>> = { greeting, quick, quote, chart };

/** Typing pauses this long before the preview reloads. */
const DEBOUNCE_MS = 400;

interface Props {
  readonly templateId: TemplateId;
  /** The chosen video shape: the preview has its proportions. */
  readonly format: VideoFormat;
  readonly fields: Readonly<Record<string, string>>;
  /** Object URLs of the chosen photos (they never leave the device for the preview). */
  readonly photoUrls: readonly string[];
  /** The chosen background, 1-based (see backgroundFile). */
  readonly background: number;
  onBackgroundChange(n: number): void;
  /**
   * The estimated timeline when the video will be read aloud: the preview takes its rhythm and length, but has no
   * voice (that is made on the server), and says so.
   */
  readonly voiceTimeline: VoiceTimeline | null;
}

/**
 * The composition playing in the hyperframes player, entirely in the browser: no server render. Underneath, when the
 * theme has several backgrounds, previous/next buttons step through them; a background's picture is only fetched
 * once it is shown, so the page loads no more than before.
 */
export function TemplatePreview({ templateId, format, fields, photoUrls, background, onBackgroundChange, voiceTimeline }: Props): ReactNode {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const spec = templateById(templateId);
  const size = FORMAT_SIZES[format];
  const target = useMemo(
    () =>
      previewDocument(
        composeTemplateHtml(LAYOUT_HTML[spec.layout], spec, format, { background, ...(voiceTimeline ? { durationSeconds: voiceTimeline.durationSeconds } : {}) }),
        compositionVariables(spec, fields, photoUrls, background, voiceTimeline ? formatCues(voiceTimeline) : ''),
        window.location.origin,
      ),
    [spec, format, fields, photoUrls, background, voiceTimeline],
  );
  // Wraps around: after the last background comes the first.
  const step = (delta: number): void => onBackgroundChange(((background - 1 + delta + spec.backgrounds) % spec.backgrounds) + 1);
  const [srcdoc, setSrcdoc] = useState(target);

  useEffect(() => {
    let live = true;
    // The player registers <hyperframes-player>; loaded on demand so other pages stay light.
    import('@hyperframes/player')
      .then(() => {
        if (live) setReady(true);
      })
      .catch((error: unknown) => console.error('preview player failed to load', error));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSrcdoc(target), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [target]);

  return (
    <figure className="preview" data-id="preview">
      <div className="preview-frame" data-format={format}>
        {ready ? <hyperframes-player srcdoc={srcdoc} runtime-src={RUNTIME_SRC} width={size.width} height={size.height} controls loop /> : null}
      </div>
      {spec.backgrounds > 1 ? (
        <div className="bg-switch" role="group" aria-label={t('create.background')} data-id="preview-background">
          <span className="label">{t('create.background')}</span>
          <button type="button" className="btn btn-ghost bg-step" aria-label={t('create.backgroundPrev')} onClick={() => step(-1)} data-id="preview-background-prev">
            ‹
          </button>
          <output className="bg-count" aria-live="polite">
            {t('create.backgroundOf', { n: background, count: spec.backgrounds })}
          </output>
          <button type="button" className="btn btn-ghost bg-step" aria-label={t('create.backgroundNext')} onClick={() => step(1)} data-id="preview-background-next">
            ›
          </button>
        </div>
      ) : null}
      <figcaption className="muted small">
        {t('create.previewNote')} {voiceTimeline ? <span data-id="preview-voice-note">{t('create.previewVoiceNote')}</span> : null}
      </figcaption>
    </figure>
  );
}
