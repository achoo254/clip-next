import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { composeTemplateHtml, compositionVariables, templateById, type LayoutId, type TemplateId } from '@clip/templates';
import greeting from '@clip/templates/project/layouts/greeting.html?raw';
import quick from '@clip/templates/project/layouts/quick.html?raw';
import quote from '@clip/templates/project/layouts/quote.html?raw';
import { useI18n } from '../i18n';
import { previewDocument, RUNTIME_SRC } from './composition-doc';

const LAYOUT_HTML: Readonly<Record<LayoutId, string>> = { greeting, quick, quote };

/** Typing pauses this long before the preview reloads. */
const DEBOUNCE_MS = 400;

interface Props {
  readonly templateId: TemplateId;
  readonly fields: Readonly<Record<string, string>>;
  /** Object URLs of the chosen photos (they never leave the device for the preview). */
  readonly photoUrls: readonly string[];
}

/** The composition playing in the hyperframes player, entirely in the browser: no server render. */
export function TemplatePreview({ templateId, fields, photoUrls }: Props): ReactNode {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const target = useMemo(() => {
    const spec = templateById(templateId);
    return previewDocument(composeTemplateHtml(LAYOUT_HTML[spec.layout], spec), compositionVariables(spec, fields, photoUrls), window.location.origin);
  }, [templateId, fields, photoUrls]);
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
      <div className="preview-frame">{ready ? <hyperframes-player srcdoc={srcdoc} runtime-src={RUNTIME_SRC} width={1080} height={1920} controls loop /> : null}</div>
      <figcaption className="muted small">{t('create.previewNote')}</figcaption>
    </figure>
  );
}
