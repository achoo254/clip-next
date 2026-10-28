import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from './account';
import { loginPageHref, safeReturnPath, signInUrl, type Me } from './api';
import { I18nProvider } from './i18n';
import { Layout } from './layout';
import { IntroPage } from './pages/intro-page';
import { LoginPage } from './pages/login-page';

function clearPreferences(): void {
  for (const name of ['hd_lang', 'hd_theme']) document.cookie = `${name}=; Max-Age=0; Path=/`;
  window.localStorage.clear();
}

function answerMe(me: Me): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(me), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  );
}

function show(path: string, page: ReactNode): void {
  render(
    <I18nProvider>
      <AccountProvider>
        <MemoryRouter initialEntries={[path]}>
          <Layout>
            <Routes>
              <Route path="*" element={page} />
            </Routes>
          </Layout>
        </MemoryRouter>
      </AccountProvider>
    </I18nProvider>,
  );
}

beforeEach(clearPreferences);
afterEach(() => {
  cleanup();
  clearPreferences();
  vi.unstubAllGlobals();
});

describe('sign-in links', () => {
  it('only comes back to a page of this site, never to the sign-in page', () => {
    expect(safeReturnPath('/tao?t=birthday')).toBe('/tao?t=birthday');
    for (const unsafe of ['https://evil.example', '//evil.example', '/\\evil', '', null, '/login', '/login?return=/x']) expect(safeReturnPath(unsafe)).toBe('/');
    expect(loginPageHref('/')).toBe('/login');
    expect(loginPageHref('/video')).toBe('/login?return=%2Fvideo');
    expect(signInUrl('//evil.example', 'en')).toBe('/auth/login?return=%2F&lang=en');
  });
});

describe('signed-out welcome', () => {
  it('has the shared hero, one sign-in call to action, the features and the footer switches', async () => {
    answerMe({ signedIn: false, signInAvailable: true });
    show('/', <IntroPage />);
    const cta = await screen.findByRole('link', { name: 'Đăng nhập bằng hoandat.com' });
    expect(cta.getAttribute('href')).toBe('/auth/login?return=%2Ftao&lang=vi');
    expect(screen.getAllByRole('link', { name: /Đăng nhập/ })).toHaveLength(2); // the header pill and the card
    expect(document.querySelector('[data-id=public-sign-in]')?.getAttribute('href')).toBe('/login');
    expect(document.querySelector('[data-id=intro-start]')).toBeNull();
    expect(document.querySelectorAll('#how [data-id^=feature-]')).toHaveLength(4);
    expect(document.querySelector('[data-id=lang-switch]')).not.toBeNull();
    expect(document.querySelector('[data-id=theme-switch]')).not.toBeNull();
  });

  it('switches the language and keeps it in the shared cookie', async () => {
    answerMe({ signedIn: false, signInAvailable: true });
    show('/', <IntroPage />);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('link', { name: 'Sign in with hoandat.com' })).not.toBeNull();
    expect(document.cookie).toContain('hd_lang=en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('opens in the language picked before the shared choice', async () => {
    window.localStorage.setItem('clip.locale', 'en');
    answerMe({ signedIn: false, signInAvailable: true });
    show('/', <IntroPage />);
    expect(await screen.findByRole('link', { name: 'Sign in with hoandat.com' })).not.toBeNull();
  });

  it('has no sign-in when it is not configured', async () => {
    answerMe({ signedIn: false, signInAvailable: false });
    show('/', <IntroPage />);
    await screen.findByRole('heading', { level: 1 });
    await vi.waitFor(() => expect(document.querySelector('[data-id=public-sign-in]')).toBeNull());
    expect(document.querySelector('[data-id=sign-in-card]')).toBeNull();
  });
});

describe('sign-in page and signed in', () => {
  it('puts the shared card on /login, back to the page the visitor came from', async () => {
    answerMe({ signedIn: false, signInAvailable: true });
    show('/login?return=%2Fvideo', <LoginPage />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Đăng nhập để tạo video');
    expect(document.querySelector('[data-id=sign-in-cta]')?.getAttribute('href')).toBe('/auth/login?return=%2Fvideo&lang=vi');
    expect(document.querySelector('[data-id=public-sign-in]')?.getAttribute('aria-current')).toBe('page');
  });

  it('offers sign-out instead of sign-in', async () => {
    answerMe({ signedIn: true, signInAvailable: true });
    show('/video', <p>Body</p>);
    expect(await screen.findByRole('button', { name: 'Đăng xuất' })).not.toBeNull();
    expect(document.querySelector('[data-id=public-sign-in]')).toBeNull();
    expect(document.querySelector('[data-id=nav-videos]')?.getAttribute('aria-current')).toBe('page');
  });
});
