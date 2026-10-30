import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { estimateVoiceTimeline, voiceById, VOICES, type Voice } from '@clip/templates/voice';
import { templateById } from '@clip/templates';
import { I18nProvider } from '../i18n';
import { VoicePicker } from './voice-picker';

afterEach(cleanup);

const found = voiceById('truc-ly');
if (!found) throw new Error('no voice');
const trucLy: Voice = found;

function show(value: Voice | null, onChange = vi.fn(), fits = true): ReturnType<typeof vi.fn> {
  const estimate = fits ? estimateVoiceTimeline(templateById('chuc-mung'), { line1: 'Chúc mừng', line2: 'Vui', line3: 'Khỏe' }, trucLy) : null;
  render(
    <I18nProvider>
      <VoicePicker value={value} onChange={onChange} estimate={estimate} speechSeconds={3} />
    </I18nProvider>,
  );
  return onChange;
}

describe('VoicePicker', () => {
  it('is off until turned on, and turns on with Trúc Ly', () => {
    const onChange = show(null);
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(trucLy);
  });

  it('offers all 11 voices and says how long the reading takes', () => {
    show(trucLy);
    expect(screen.getAllByRole('option')).toHaveLength(VOICES.length);
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'truc-ly');
    expect(document.querySelector('[data-id="voice-estimate"]')?.textContent).toMatch(/12/);
  });

  it('warns when the text is too long to read in a video', () => {
    show(trucLy, vi.fn(), false);
    expect(screen.getByRole('alert').textContent).toMatch(/20/);
  });

  it('turns off', () => {
    const onChange = show(trucLy);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
