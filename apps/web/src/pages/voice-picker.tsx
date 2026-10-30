import type { ReactNode } from 'react';
import { MAX_DURATION_SECONDS } from '@clip/templates';
import { DEFAULT_VOICE_ID, VOICES, type Voice, type VoiceTimeline } from '@clip/templates/voice';
import { useI18n } from '../i18n';

interface Props {
  /** The chosen voice, null when the text is not read. */
  readonly value: Voice | null;
  onChange(voice: Voice | null): void;
  /** The estimated timeline of the current text in the chosen voice; null when it would not fit in a video. */
  readonly estimate: VoiceTimeline | null;
  /** Estimated seconds of speech (the sum of the lines). */
  readonly speechSeconds: number;
}

/** Voice on or off, which of the 11 voices, and whether the text fits in a video when read. */
export function VoicePicker({ value, onChange, estimate, speechSeconds }: Props): ReactNode {
  const { t, locale } = useI18n();
  const label = (v: Voice): string => `${v.preset} · ${t(`create.voice.${v.gender}`)}, ${t(`create.voice.${v.region}`)}, ${v.style[locale]}`;
  const fallback = VOICES.find((v) => v.id === DEFAULT_VOICE_ID) ?? VOICES[0] ?? null;
  return (
    <div className="field" role="group" aria-labelledby="voice-label" data-id="voice">
      <span id="voice-label" className="label">
        {t('create.voice')}
      </span>
      <label className="check" data-id="voice-on">
        <input type="checkbox" checked={value !== null} onChange={(e) => onChange(e.target.checked ? fallback : null)} />
        {t('create.voiceOn')}
      </label>
      {value ? (
        <>
          <label className="visually-hidden" htmlFor="voice-pick">
            {t('create.voicePick')}
          </label>
          <select id="voice-pick" className="input" value={value.id} onChange={(e) => onChange(VOICES.find((v) => v.id === e.target.value) ?? value)} data-id="voice-pick">
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {label(v)}
              </option>
            ))}
          </select>
          {estimate ? (
            <p className="muted small" aria-live="polite" data-id="voice-estimate">
              {t('create.voiceEstimate', { speech: Math.round(speechSeconds), video: Math.round(estimate.durationSeconds) })}
            </p>
          ) : (
            <p className="alert alert-error" role="alert" data-id="voice-too-long">
              {t('create.voiceTooLong', { max: MAX_DURATION_SECONDS })}
            </p>
          )}
        </>
      ) : null}
      <p className="muted small">{t('create.voiceHint')}</p>
    </div>
  );
}
