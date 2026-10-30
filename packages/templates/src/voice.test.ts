import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeTemplateHtml, compositionVariables, LAYOUT_IDS, MAX_DURATION_SECONDS, TEMPLATES, templateById } from './catalog';
import { PROJECT_DIR } from './project';
import {
  DEFAULT_VOICE_ID,
  defaultSceneStarts,
  estimateSpeechSeconds,
  estimateVoiceTimeline,
  formatCues,
  isSpeakable,
  MIN_SCENE_SECONDS,
  parseVoice,
  speechText,
  VOICE_LEAD_SECONDS,
  VOICE_TAIL_SECONDS,
  voiceById,
  voiceSegments,
  voiceTimeline,
  VOICES,
} from './voice';

const greeting = templateById('chuc-mung');
const quick = templateById('ke-nhanh');
const quote = templateById('trich-dan');
const chart = templateById('la-so');

describe('voices', () => {
  it('offers all 11 presets of the model, with unique ids safe to store, Trúc Ly first and by default', () => {
    expect(VOICES).toHaveLength(11);
    expect(new Set(VOICES.map((v) => v.id)).size).toBe(11);
    expect(new Set(VOICES.map((v) => v.preset)).size).toBe(11);
    for (const v of VOICES) expect(v.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(VOICES[0]?.id).toBe(DEFAULT_VOICE_ID);
    expect(voiceById(DEFAULT_VOICE_ID)?.preset).toBe('Trúc Ly');
  });

  it('reads a job’s voice: none when absent or empty, a known id, anything else refused', () => {
    expect(parseVoice(undefined)).toBeNull();
    expect(parseVoice('')).toBeNull();
    expect(parseVoice(null)).toBeNull();
    expect(parseVoice('adam')?.preset).toBe('Adam');
    expect(parseVoice('Trúc Ly')).toBeUndefined();
    expect(parseVoice('../x')).toBeUndefined();
    expect(parseVoice(3)).toBeUndefined();
  });
});

describe('voiceSegments', () => {
  it('reads each layout’s text in the order it shows, skipping what is not on screen', () => {
    expect(voiceSegments(greeting, { line1: 'A', line2: 'B', line3: 'C' })).toEqual(['A', 'B', 'C']);
    expect(voiceSegments(quick, { title: 'T', point1: 'a', point2: 'b', point3: 'c', point4: '', point5: 'e' })).toEqual(['T', 'a', 'b', 'c', 'e']);
    expect(voiceSegments(quote, { quote: 'Q', author: '' })).toEqual(['Q']);
    expect(voiceSegments(quote, { quote: 'Q', author: 'Nguyễn Du' })).toEqual(['Q', 'Nguyễn Du']);
    expect(voiceSegments(chart, { name: 'Lan', line1: 'Tuổi Mùi', line2: 'Mộc Tam Cục', reading: 'R', animal: 'mui', cuc: 'moc-tam' })).toEqual(['Lan. Tuổi Mùi', 'Mộc Tam Cục', 'R']);
    expect(voiceSegments(chart, { name: '', line1: 'Tuổi Mùi', line2: 'L2', reading: 'R' })[0]).toBe('Tuổi Mùi');
  });

  it('counts a line of emoji alone as nothing to read', () => {
    expect(isSpeakable('🎉🎂')).toBe(false);
    expect(isSpeakable('20')).toBe(true);
    const voice = voiceById('adam');
    if (!voice) throw new Error('no voice');
    expect(estimateSpeechSeconds('🎉', voice)).toBe(0);
  });
});

describe('speechText', () => {
  it.each([
    ['Chúc mừng 20/11!', 'Chúc mừng ngày 20 tháng 11!'],
    ['Hẹn 08/03 nhé', 'Hẹn ngày 8 tháng 3 nhé'],
    ['Ngày 20/11 vui vẻ', 'Ngày 20 tháng 11 vui vẻ'],
    ['20/11/2026', '20/11/2026'],
    ['Mở cửa 24/7', 'Mở cửa 24/7'],
    ['Ngày 30/02', 'Ngày 30/02'],
    ['Tỉ lệ 1,5/10', 'Tỉ lệ 1,5/10'],
    ['Lúc 9:30', 'Lúc 9:30'],
    ['Từ 8h-17h', 'Từ 8h đến 17h'],
    ['Mở T2-T6, nghỉ CN', 'Mở thứ 2 đến thứ 6, nghỉ chủ nhật'],
    ['Thứ 2 – thứ 6', 'Thứ 2 đến thứ 6'],
    ['Đồng giá 50k', 'Đồng giá 50 nghìn'],
    ['Chỉ 1,5tr', 'Chỉ 1,5 triệu'],
    ['5km và 2 kg', '5km và 2 kg'],
    ['Top #1', 'Top số 1'],
    ['Tuổi Mùi · Mệnh Thiên Đồng', 'Tuổi Mùi, Mệnh Thiên Đồng'],
    ['Giảm 30% cho 100 khách', 'Giảm 30% cho 100 khách'],
  ])('%s → %s', (typed, spoken) => {
    expect(speechText(typed)).toBe(spoken);
  });

  it('works on text however the keyboard composed it', () => {
    expect(speechText('Ngày 1/6'.normalize('NFD'))).toBe('Ngày 1 tháng 6'.normalize('NFC'));
  });
});

describe('voiceTimeline', () => {
  it('keeps the layout’s rhythm when every line fits its scene', () => {
    const timeline = voiceTimeline(greeting, [2, 2, 2]);
    expect(timeline?.sceneStarts).toEqual([0, 4, 8]);
    expect(timeline?.voiceStarts).toEqual([VOICE_LEAD_SECONDS, 4 + VOICE_LEAD_SECONDS, 8 + VOICE_LEAD_SECONDS]);
    expect(timeline?.durationSeconds).toBe(12);
  });

  it('gives a long line the time it needs, and the video gets longer', () => {
    const timeline = voiceTimeline(greeting, [5, 2, 4]);
    // 0.5 lead + 5 s + 0.4 gap; then the layout's 4 s; then 0.5 + 4 + 1.2 tail.
    expect(timeline?.sceneStarts).toEqual([0, 5.9, 9.9]);
    expect(timeline?.durationSeconds).toBe(15.6);
  });

  it('drops the layout’s rhythm before giving up, and gives up past the longest video', () => {
    // 18 s quick layout, title + 3 points: with the layout's floors this is over 20 s, without them it fits.
    const tight = voiceTimeline(quick, [1, 4.6, 4.6, 4.6]);
    expect(tight).not.toBeNull();
    expect(tight?.sceneStarts[1]).toBe(MIN_SCENE_SECONDS);
    expect(tight?.durationSeconds).toBeLessThanOrEqual(MAX_DURATION_SECONDS);
    expect(voiceTimeline(greeting, [7, 7, 7])).toBeNull();
    expect(voiceTimeline(greeting, [])).toBeNull();
  });

  it('starts each scene after the previous one, with the tail after the last line', () => {
    for (const spec of [greeting, quick, quote, chart]) {
      const seconds = voiceSegments(spec, Object.fromEntries(spec.fields.map((f) => [f.id, f.placeholder.vi]))).map(() => 1.5);
      const timeline = voiceTimeline(spec, seconds);
      if (!timeline) throw new Error(`${spec.id}: no timeline`);
      timeline.sceneStarts.forEach((start, i) => {
        if (i > 0) expect(start).toBeGreaterThan(timeline.sceneStarts[i - 1] ?? 0);
      });
      const lastVoiceEnd = (timeline.voiceStarts.at(-1) ?? 0) + 1.5;
      expect(timeline.durationSeconds).toBeGreaterThanOrEqual(lastVoiceEnd + VOICE_TAIL_SECONDS - 0.01);
    }
  });

  it('matches the default rhythm the layout scripts use', () => {
    expect(defaultSceneStarts(quick, 4)).toEqual([0, 3, 8, 13]);
    expect(defaultSceneStarts(quote, 1)).toEqual([0]);
    expect(defaultSceneStarts(chart, 3)).toEqual([0, 3.6, 7.2]);
    for (const layout of ['greeting', 'quick', 'quote', 'chart']) {
      const script = readFileSync(path.join(PROJECT_DIR, 'scripts', `${layout}.js`), 'utf8');
      expect(script, layout).toContain('T.cues(vars, ');
    }
  });

  it('formats the scene starts as the composition’s cues', () => {
    expect(formatCues({ sceneStarts: [0, 5.9, 9.9], voiceStarts: [], durationSeconds: 15.6 })).toBe('0,5.9,9.9');
  });
});

describe('estimates', () => {
  it('lets every template’s sample text be read in every voice', () => {
    for (const spec of TEMPLATES) {
      const fields = Object.fromEntries(spec.fields.map((f) => [f.id, f.required || f.choices ? f.placeholder.vi : '']));
      for (const voice of VOICES) expect(estimateVoiceTimeline(spec, fields, voice), `${spec.id} ${voice.id}`).not.toBeNull();
    }
  });

  it('refuses text too long to read in a video', () => {
    const long = 'Chúc bạn một tuổi mới thật nhiều niềm vui và sức khỏe dồi dào';
    const slow = voiceById('duc-tri');
    if (!slow) throw new Error('no voice');
    expect(estimateVoiceTimeline(greeting, { line1: long, line2: long, line3: long }, slow)).toBeNull();
  });

  it('estimates slower voices as longer', () => {
    const text = 'Chúc mừng sinh nhật, chúc bạn tuổi mới thật nhiều niềm vui';
    const slow = voiceById('duc-tri');
    const fast = voiceById('adam');
    if (!slow || !fast) throw new Error('voices missing');
    expect(estimateSpeechSeconds(text, slow)).toBeGreaterThan(estimateSpeechSeconds(text, fast));
  });
});

describe('a voiced composition', () => {
  for (const layout of LAYOUT_IDS) {
    const spec = TEMPLATES.find((t) => t.layout === layout);
    if (!spec) throw new Error(`no template uses ${layout}`);
    const html = readFileSync(path.join(PROJECT_DIR, 'layouts', `${layout}.html`), 'utf8');

    it(`${layout}: lasts as long as its lines take, the music and stage included`, () => {
      const composed = composeTemplateHtml(html, spec, '9:16', { durationSeconds: 16.4 });
      expect(composed).not.toContain(`data-duration="${spec.durationSeconds}"`);
      expect(composed.match(/data-duration="16.4"/g)?.length).toBeGreaterThanOrEqual(3);
      expect(composed).toMatch(/<audio id="music"[^>]*data-duration="16.4"/);
    });

    it(`${layout}: refuses a length past the longest video`, () => {
      expect(() => composeTemplateHtml(html, spec, '9:16', { durationSeconds: MAX_DURATION_SECONDS + 1 })).toThrow();
    });
  }

  it('times the video background for the whole voiced video', () => {
    const spec = { ...greeting, videoBackground: true };
    const html = readFileSync(path.join(PROJECT_DIR, 'layouts', `${spec.layout}.html`), 'utf8');
    expect(composeTemplateHtml(html, spec, '9:16', { durationSeconds: 15 })).toMatch(/<video id="bg"[^>]*data-duration="15"/);
  });

  it('passes the cues as the last variable', () => {
    expect(compositionVariables(greeting, {}, [], 1, '0,5.9,9.9').cues).toBe('0,5.9,9.9');
  });
});
