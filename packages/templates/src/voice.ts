/**
 * The spoken voice of a video (VieNeu-TTS v3 Nano, read on the server before the render): the voices a person may
 * choose, which text of a template is read and in what order, how that text is made readable (dates, times, money),
 * and the timeline that puts each line on screen while it is being read. Browser-safe: the web app estimates the
 * timeline for its preview, the server checks that the text fits in a video, the worker times the real recording.
 */
import { LAYOUTS, MAX_DURATION_SECONDS, type Localized, type TemplateSpec } from './catalog';

export interface Voice {
  /** Stored on jobs and sent by the web app: never rename one. */
  readonly id: string;
  /** The preset's name in the model (what the synthesis script is given). */
  readonly preset: string;
  readonly gender: 'female' | 'male';
  /** Accent, as the model describes the preset. */
  readonly region: 'north' | 'south';
  readonly style: Localized;
  /**
   * Characters of typed text read per second, measured on the production server (three test sentences, 259
   * characters). Used only to estimate; the real timeline comes from the recorded audio.
   */
  readonly charsPerSecond: number;
}

const NATURAL: Localized = { vi: 'tự nhiên', en: 'natural' };
const NEWS: Localized = { vi: 'đọc tin', en: 'newsreader' };
const STORY: Localized = { vi: 'kể chuyện', en: 'storyteller' };

/** All 11 preset voices of VieNeu-TTS v3 Nano; the first is the default. */
export const VOICES: readonly Voice[] = [
  { id: 'truc-ly', preset: 'Trúc Ly', gender: 'female', region: 'north', style: NATURAL, charsPerSecond: 13.6 },
  { id: 'mai-anh', preset: 'Mai Anh', gender: 'female', region: 'north', style: NEWS, charsPerSecond: 15.3 },
  { id: 'xuan-tien', preset: 'Xuân Tiên', gender: 'female', region: 'north', style: NEWS, charsPerSecond: 17 },
  { id: 'my-duyen', preset: 'Mỹ Duyên', gender: 'female', region: 'north', style: STORY, charsPerSecond: 12.3 },
  { id: 'ai-han', preset: 'Ái Hân', gender: 'female', region: 'south', style: NEWS, charsPerSecond: 13.8 },
  { id: 'minh-quan', preset: 'Minh Quân', gender: 'male', region: 'north', style: NATURAL, charsPerSecond: 16.7 },
  { id: 'manh-dung', preset: 'Mạnh Dũng', gender: 'male', region: 'north', style: NATURAL, charsPerSecond: 18.2 },
  { id: 'huu-quan', preset: 'Hữu Quân', gender: 'male', region: 'north', style: NEWS, charsPerSecond: 18.8 },
  { id: 'anh-khoi', preset: 'Anh Khôi', gender: 'male', region: 'north', style: STORY, charsPerSecond: 15.3 },
  { id: 'duc-tri', preset: 'Đức Trí', gender: 'male', region: 'north', style: STORY, charsPerSecond: 11 },
  { id: 'adam', preset: 'Adam', gender: 'male', region: 'south', style: NATURAL, charsPerSecond: 19.7 },
];

export const DEFAULT_VOICE_ID = 'truc-ly';

export function voiceById(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}

/**
 * The voice a job asked for: absent or empty is no voice (old clients, old jobs, voice off); an id of VOICES is that
 * voice; anything else is refused (`undefined`).
 */
export function parseVoice(raw: unknown): Voice | null | undefined {
  if (raw === undefined || raw === null || raw === '') return null;
  return typeof raw === 'string' ? voiceById(raw) : undefined;
}

/**
 * What is read, in the order the layout shows it: one segment per scene (or per card), each the text of one or more
 * fields. Optional fields left empty, and the quick layout's unused points, have no segment, exactly as they have no
 * card on screen. The layout scripts count the segments the same way.
 */
export function voiceSegments(spec: TemplateSpec, fields: Readonly<Record<string, string>>): string[] {
  const value = (id: string): string => (fields[id] ?? '').trim();
  const present = (texts: readonly string[]): string[] => texts.filter((t) => t !== '');
  switch (spec.layout) {
    case 'greeting':
      return [value('line1'), value('line2'), value('line3')];
    case 'quick':
      return [value('title'), ...present(['point1', 'point2', 'point3', 'point4', 'point5'].map(value))];
    case 'quote':
      return present([value('quote'), value('author')]);
    case 'chart': {
      const name = value('name');
      return [name === '' ? value('line1') : `${withStop(name)} ${value('line1')}`, value('line2'), value('reading')];
    }
  }
}

/** The text with a full stop at its end unless it already ends a sentence: a pause between joined fields. */
function withStop(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/** Whether there is anything to read in a text (a line of emoji alone is not read). */
export function isSpeakable(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

function daysIn(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/**
 * A line as the voice should read it. The model's own normaliser reads most numbers, times, percentages, money and
 * dates with a year correctly; this fixes what it gets wrong, measured on the server:
 * - a bare day/month ("20/11") is read as a fraction ("hai mươi trên mười một"): it becomes "ngày 20 tháng 11";
 *   "24/7" (open all hours) and impossible dates stay as they are;
 * - weekday shorthands ("T2", "CN") and ranges with a dash ("8h-17h", "T2-T6") lose the word "đến";
 * - "50k" reads "năm mươi ca", "2tr" is not read as millions;
 * - a bullet "·" or "•" between two parts is a pause.
 * The video shows the text as typed; only the voice gets this.
 */
export function speechText(text: string): string {
  let s = text.normalize('NFC').trim();
  s = s.replace(/\s*[·•|]\s*/g, ', ');
  s = s.replace(/\bCN\b/g, 'chủ nhật');
  s = s.replace(/\bT([2-7])\b/g, 'thứ $1');
  const rangeEnd = String.raw`(?:thứ [2-7]|chủ nhật|\d{1,2}h(?:\d{2})?\b)`;
  s = s.replace(new RegExp(String.raw`(${rangeEnd})\s*[-–]\s*(?=${rangeEnd})`, 'giu'), '$1 đến ');
  s = s.replace(/(\d+(?:[.,]\d+)?)\s?k\b/giu, '$1 nghìn');
  s = s.replace(/(\d+(?:[.,]\d+)?)\s?tr\b/giu, '$1 triệu');
  s = s.replace(/#(\d)/g, 'số $1');
  s = s.replace(/(^|[^\p{L}\p{N}/.,:])(\d{1,2})\/(\d{1,2})(?![\d/])/gu, (match: string, before: string, d: string, m: string, offset: number, whole: string) => {
    const day = Number(d);
    const month = Number(m);
    if (`${d}/${m}` === '24/7' || month < 1 || month > 12 || day < 1 || day > daysIn(month)) return match;
    const saysDay = /ngày\s*$/iu.test(whole.slice(0, offset + before.length));
    return `${before}${saysDay ? '' : 'ngày '}${day} tháng ${month}`;
  });
  return s.replace(/\s+/g, ' ').trim();
}

/** A spoken line starts this long after its scene appears (the text has risen by then). */
export const VOICE_LEAD_SECONDS = 0.5;
/** Silence after a line before the next scene comes in. */
export const VOICE_GAP_SECONDS = 0.4;
/** After the last line, before the end (the music fades out). */
export const VOICE_TAIL_SECONDS = 1.2;
/** No scene is shorter than this, however short its line. */
export const MIN_SCENE_SECONDS = 2;

export interface VoiceTimeline {
  /** When each segment's scene comes in, seconds from the start (the composition's `cues`). */
  readonly sceneStarts: readonly number[];
  /** When each segment's recording starts. */
  readonly voiceStarts: readonly number[];
  readonly durationSeconds: number;
}

/**
 * When each segment comes on screen without a voice: the layout's own rhythm (as its script times it), for
 * `count` segments.
 */
export function defaultSceneStarts(spec: TemplateSpec, count: number): number[] {
  switch (spec.layout) {
    case 'greeting':
      return [0, 4, 8];
    case 'quick': {
      const slot = (spec.durationSeconds - 3) / Math.max(1, count - 1);
      return [0, ...Array.from({ length: count - 1 }, (_, i) => 3 + i * slot)];
    }
    case 'quote':
      return [0, 1.6].slice(0, count);
    case 'chart':
      return [0, 3.6, 7.2];
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * The timeline of a voiced video from the length of each segment's recording (0 for a segment with nothing to read):
 * each scene lasts as long as the layout gives it, or longer when its line needs more, so the text is on screen while
 * it is read. When that would pass MAX_DURATION_SECONDS, the scenes keep only what their lines need (at least
 * MIN_SCENE_SECONDS). null when even that does not fit.
 */
export function voiceTimeline(spec: TemplateSpec, seconds: readonly number[]): VoiceTimeline | null {
  const count = seconds.length;
  if (count === 0) return null;
  const defaults = defaultSceneStarts(spec, count);
  const defaultLengths = defaults.map((start, i) => (defaults[i + 1] ?? LAYOUTS[spec.layout].durationSeconds) - start);
  const needed = seconds.map((s, i) => Math.max(MIN_SCENE_SECONDS, VOICE_LEAD_SECONDS + s + (i === count - 1 ? VOICE_TAIL_SECONDS : VOICE_GAP_SECONDS)));
  for (const lengths of [needed.map((n, i) => Math.max(n, defaultLengths[i] ?? 0)), needed]) {
    const total = lengths.reduce((a, b) => a + b, 0);
    if (total > MAX_DURATION_SECONDS) continue;
    const sceneStarts = lengths.map((_, i) => round2(lengths.slice(0, i).reduce((a, b) => a + b, 0)));
    return {
      sceneStarts,
      voiceStarts: sceneStarts.map((start) => round2(start + VOICE_LEAD_SECONDS)),
      durationSeconds: Math.ceil(total * 10) / 10,
    };
  }
  return null;
}

/**
 * Estimated reading time of a text in a voice: its characters at the voice's measured pace, slowed by 15 % so the
 * estimate errs long (the worker refuses a recording that does not fit, after the person has waited).
 */
export function estimateSpeechSeconds(text: string, voice: Voice): number {
  return isSpeakable(text) ? [...speechText(text)].length / (voice.charsPerSecond * 0.85) : 0;
}

/** The estimated timeline of a template's text read in a voice (see voiceTimeline); null when it would not fit. */
export function estimateVoiceTimeline(spec: TemplateSpec, fields: Readonly<Record<string, string>>, voice: Voice): VoiceTimeline | null {
  return voiceTimeline(
    spec,
    voiceSegments(spec, fields).map((text) => estimateSpeechSeconds(text, voice)),
  );
}

/** The scene starts as the composition's `cues` variable: seconds, comma-separated. */
export function formatCues(timeline: VoiceTimeline): string {
  return timeline.sceneStarts.map((s) => String(s)).join(',');
}
