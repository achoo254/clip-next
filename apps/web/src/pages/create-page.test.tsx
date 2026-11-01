import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '../account';
import { signedOut, type Me } from '../api';
import { I18nProvider } from '../i18n';
import { CreatePage } from './create-page';

// The preview is the hyperframes player, a custom element that needs a real browser (jsdom cannot construct it).
vi.mock('../preview/template-preview', () => ({ TemplatePreview: () => null }));

/** Every request the page made, and /api/me answering `me`. */
function answerMe(me: Me): { method: string; path: string }[] {
  const calls: { method: string; path: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', path });
      return new Response(JSON.stringify(me), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
  return calls;
}

function show(path: string): void {
  render(
    <I18nProvider>
      <AccountProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/tao" element={<CreatePage />} />
          </Routes>
        </MemoryRouter>
      </AccountProvider>
    </I18nProvider>,
  );
}

function hrefOf(element: Element | null): URL {
  return new URL(element?.getAttribute('href') ?? '', 'https://clip.hoandat.com');
}

beforeEach(() => window.sessionStorage.clear());
afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('a guest on the create page', () => {
  it('fills the template in, and where the create button would be is invited to sign up, back here', async () => {
    const calls = answerMe(signedOut(true));
    show('/tao?t=chuc-mung&f=1:1');
    const signUp = await screen.findByRole('link', { name: 'Tạo tài khoản hoandat.com miễn phí' });
    expect(screen.getByRole('heading', { name: 'Ưng rồi? Đăng ký miễn phí để tạo video này' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tạo video' })).toBeNull();

    const field = document.querySelector<HTMLInputElement>('#field-line1');
    if (!field) throw new Error('no first line');
    fireEvent.change(field, { target: { value: 'Mừng sinh nhật Lan' } });

    const url = hrefOf(signUp);
    expect(url.pathname).toBe('/auth/login');
    expect(url.searchParams.get('signup')).toBe('1');
    expect(url.searchParams.get('lang')).toBe('vi');
    expect(url.searchParams.get('return')).toBe('/tao?t=chuc-mung&f=1:1');
    // The typed text waits in this tab's session for the way back.
    expect(window.sessionStorage.getItem('clip.draft.v2')).toContain('Mừng sinh nhật Lan');

    // Someone with an account signs in instead, without the sign-up screen.
    const signIn = hrefOf(screen.getByRole('link', { name: 'Đã có tài khoản? Đăng nhập' }));
    expect(signIn.searchParams.get('signup')).toBeNull();
    expect(signIn.searchParams.get('return')).toBe(url.searchParams.get('return'));
    // Nothing was sent to make a video.
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('comes back signed in with the text typed before and the create button', async () => {
    window.sessionStorage.setItem('clip.draft.v2', JSON.stringify({ greeting: { line1: 'Mừng sinh nhật Lan' } }));
    answerMe({ ...signedOut(true), signedIn: true });
    show('/tao?t=chuc-mung&f=1:1');
    expect(await screen.findByRole('button', { name: 'Tạo video' })).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('#field-line1')?.value).toBe('Mừng sinh nhật Lan');
    expect(document.querySelector('[data-id=sign-in-card]')).toBeNull();
  });
});
