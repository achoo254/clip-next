import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  fieldsFromQuery,
  linkParams,
  parseBackground,
  isAllowedChoice,
  isTemplateId,
  normalizeText,
  templateById,
  validateInput,
  type LayoutId,
  type Locale,
  type TemplateId,
  type TemplateSpec,
  type TextField,
} from '@clip/templates';
import { createJob, signInUrl } from '../api';
import { useAccount } from '../account';
import { errorMessage } from '../error-message';
import { useI18n } from '../i18n';
import { useHere } from '../layout';
import { TemplatePreview } from '../preview/template-preview';
import { TemplatePicker } from './template-picker';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
/**
 * Typed text survives the round trip through sign-in (photos cannot: they stay in the page). Drafts are kept per
 * layout, so switching between templates of one layout (Birthday → Tết) keeps what was typed.
 */
const DRAFT_KEY = 'clip.draft.v2';

interface Photo {
  readonly file: File;
  readonly url: string;
}

type Drafts = Partial<Record<LayoutId, Record<string, string>>>;

function loadDrafts(): Drafts {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Drafts) : {};
  } catch {
    return {};
  }
}

/** The template's placeholders, so the preview shows a full video before anything is typed. */
function sampleFields(id: TemplateId, locale: Locale): Record<string, string> {
  return Object.fromEntries(templateById(id).fields.map((f) => [f.id, f.required ? f.placeholder[locale] : '']));
}

/** Whether the address carries values for the template's fields (a link that fills it in). */
function linkFills(spec: TemplateSpec, params: URLSearchParams): boolean {
  return spec.fields.some((f) => params.has(f.id));
}

/**
 * The value of a choice field: what was picked (or filled in by a link), else the template's sample, so the select,
 * the preview and the render agree before the person touches it. "" (optional fields only) means none.
 */
function choiceValue(field: TextField, stored: string | undefined, locale: Locale): string {
  if (stored !== undefined && (stored === '' ? !field.required : isAllowedChoice(field, stored))) return stored;
  return field.placeholder[locale];
}

export function CreatePage(): ReactNode {
  const { t, locale } = useI18n();
  const { me } = useAccount();
  const here = useHere();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requested = params.get('t');
  const templateId: TemplateId = isTemplateId(requested) ? requested : 'chuc-mung';
  const spec = templateById(templateId);
  // The chosen background rides in the address (`&bg=3`), so it survives the sign-in round trip; picking another
  // template drops it (back to the first). Anything invalid there is the first too.
  const background = parseBackground(spec, params.get('bg')) ?? 1;
  const setBackground = (n: number): void => setParams(n === 1 ? { t: templateId } : { t: templateId, bg: String(n) }, { replace: true });
  // A link may fill the template in (`/tao?t=la-so&animal=mui#name=Lan&line1=…`, e.g. from the Tử Vi app; free text
  // rides in the #fragment, see linkParams): its valid values replace this layout's draft when the page opens.
  const link = useMemo(() => linkParams(location.search, location.hash), [location.search, location.hash]);
  const [drafts, setDrafts] = useState<Drafts>(() => {
    const saved = loadDrafts();
    return linkFills(spec, link) ? { ...saved, [spec.layout]: fieldsFromQuery(spec, link) } : saved;
  });
  const [photos, setPhotos] = useState<readonly Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fields = useMemo(() => drafts[spec.layout] ?? {}, [drafts, spec.layout]);

  // The filled-in values then leave the address (query and fragment), so they are not kept in the history and a later
  // sign-in round trip keeps what was edited since.
  useEffect(() => {
    if (linkFills(spec, link)) void navigate({ search: `?t=${templateId}`, hash: '' }, { replace: true });
  }, [link, navigate, spec, templateId]);

  // Opened from such a link, the page starts at the filled-in template rather than at the top of the template grid.
  const [openedFromLink] = useState(() => linkFills(spec, link));
  const filledRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (openedFromLink) filledRef.current?.scrollIntoView({ block: 'start' });
  }, [openedFromLink]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    } catch {
      // Not saved: the text is only lost if the person leaves for sign-in.
    }
  }, [drafts]);

  // Object URLs hold the photo in memory until revoked: on removal, and for the rest when the page goes away.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const usable = useMemo(() => photos.slice(0, spec.photos.max), [photos, spec.photos.max]);
  const photoUrls = useMemo(() => usable.map((p) => p.url), [usable]);
  const previewFields = useMemo(() => {
    const sample = sampleFields(templateId, locale);
    return Object.fromEntries(
      spec.fields.map((f) => [f.id, f.choices ? choiceValue(f, fields[f.id], locale) : normalizeText(fields[f.id] ?? '') || sample[f.id] || '']),
    );
  }, [fields, spec, templateId, locale]);

  const setField = (id: string, value: string): void => setDrafts((d) => ({ ...d, [spec.layout]: { ...(d[spec.layout] ?? {}), [id]: value } }));

  const addPhotos = (list: FileList | null): void => {
    setMessage(null);
    const chosen = [...(list ?? [])];
    for (const file of chosen) {
      if (!PHOTO_TYPES.has(file.type)) return setMessage({ kind: 'error', text: t('create.photoType', { name: file.name }) });
      if (file.size > MAX_PHOTO_BYTES) return setMessage({ kind: 'error', text: t('create.photoTooBig', { name: file.name }) });
    }
    const room = Math.max(0, spec.photos.max - photos.length);
    setPhotos([...photos, ...chosen.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const removePhoto = (index: number): void => {
    const removed = photos[index];
    if (removed) URL.revokeObjectURL(removed.url);
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setMessage(null);
    const typed = Object.fromEntries(spec.fields.map((f) => [f.id, f.choices ? choiceValue(f, fields[f.id], locale) : (fields[f.id] ?? '')]));
    const check = validateInput(templateId, typed, usable.length);
    if (!check.ok) {
      const code = check.error === 'missing-field' || check.error === 'field-too-long' || check.error === 'too-few-photos' ? check.error : 'generic';
      return setMessage({ kind: 'error', text: code === 'generic' ? t('error.generic') : t(`error.${code}`, { min: spec.photos.min }) });
    }
    setBusy(true);
    try {
      await createJob(templateId, check.fields, background, usable.map((p) => p.file));
      setMessage({ kind: 'ok', text: t('create.queued') });
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error, t, locale, spec.photos.min) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="create" data-id="create">
      <h1>{t('create.title')}</h1>
      <div className="create-grid">
        <form className="card create-form" onSubmit={(e) => void submit(e)} data-id="create-form">
          <TemplatePicker value={templateId} onChange={(id) => setParams({ t: id }, { replace: true })} />
          <p className="muted small template-description" ref={filledRef}>
            {spec.description[locale]}
          </p>

          {spec.fields.map((field) => {
            const id = `field-${field.id}`;
            if (field.choices) {
              return (
                <div className="field" key={field.id}>
                  <label className="label" htmlFor={id}>
                    {field.label[locale]}
                  </label>
                  <select id={id} className="input" value={choiceValue(field, fields[field.id], locale)} onChange={(e) => setField(field.id, e.target.value)} data-id={id}>
                    {field.required ? null : <option value="">{t('create.none')}</option>}
                    {field.choices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label[locale]}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            const value = fields[field.id] ?? '';
            return (
              <div className="field" key={field.id}>
                <label className="label" htmlFor={id}>
                  {field.label[locale]} {field.required ? null : <span className="muted">{t('create.optional')}</span>}
                </label>
                <input
                  id={id}
                  className="input"
                  value={value}
                  maxLength={field.maxLength}
                  placeholder={field.placeholder[locale]}
                  required={field.required}
                  onChange={(e) => setField(field.id, e.target.value)}
                  data-id={id}
                />
                <span className="muted small counter">{t('create.charsLeft', { count: [...value].length, max: field.maxLength })}</span>
              </div>
            );
          })}

          <div className="field">
            <span className="label">{spec.photos.max > 0 ? t('create.photos', { min: spec.photos.min, max: spec.photos.max }) : t('create.photosNone')}</span>
            {spec.photos.max > 0 ? (
              <>
                <ul className="photo-list">
                  {usable.map((photo, index) => (
                    <li key={photo.url} className="photo-item">
                      <img src={photo.url} alt="" width="72" height="72" />
                      <button type="button" className="btn btn-ghost small" onClick={() => removePhoto(index)} data-id={`photo-remove-${index + 1}`}>
                        {t('create.removePhoto', { n: index + 1 })}
                      </button>
                    </li>
                  ))}
                </ul>
                {usable.length < spec.photos.max ? (
                  <label className="btn btn-secondary file-button" data-id="photo-add">
                    {t('create.addPhoto')}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="visually-hidden"
                      onChange={(e) => {
                        addPhotos(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : null}
                <p className="muted small">{t('create.photosHint')}</p>
              </>
            ) : null}
          </div>

          {message ? (
            <p className={`alert ${message.kind === 'ok' ? 'alert-success' : 'alert-error'}`} role={message.kind === 'ok' ? 'status' : 'alert'} data-id="create-message">
              {message.text} {message.kind === 'ok' ? <Link to="/video">{t('nav.videos')}</Link> : null}
            </p>
          ) : null}

          {me?.signedIn ? (
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy} data-id="render">
              {busy ? t('create.rendering') : t('create.render')}
            </button>
          ) : (
            <a className="btn btn-primary btn-lg" href={signInUrl(here, locale)} data-id="render-sign-in">
              {t('create.signInToRender')}
            </a>
          )}
        </form>

        <section className="preview-column" aria-label={t('create.preview')} data-id="preview-column">
          <h2 className="label">{t('create.preview')}</h2>
          <TemplatePreview templateId={templateId} fields={previewFields} photoUrls={photoUrls} background={background} onBackgroundChange={setBackground} />
        </section>
      </div>
    </div>
  );
}
