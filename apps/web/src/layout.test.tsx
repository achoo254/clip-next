import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from './account';
import { loginPageHref, safeReturnPath, signedOut, signInUrl, type Me } from './api';
import { I18nProvider } from './i18n';
import { Layout } from './layout';
import { IntroPage } from './pages/intro-page';
import { LoginPage } from './pages/login-page';

function clearPreferences(): void {
  for (const name of ['hd_lang', 'hd_theme']) document.cookie = `${name}=; Max-Age=0; Path=/`;
  window.localStorage.clear();
}

/** /api/me answers `me` (profile fields null unless given); sign-out answers 204. Returns the fetch mock. */
function answerMe(me: Pick<Me, 'signedIn' | 'signInAvailable'> & Partial<Me>): ReturnType<typeof vi.fn> {
  const body: Me = { ...signedOut(me.signInAvailable), ...me };
  const fetchMock = vi.fn(async (path: string) =>
    path === '/auth/logout'
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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
  it('has the hero, one sign-in call to action with its note, the features and the language switch', async () => {
    answerMe({ signedIn: false, signInAvailable: true });
    show('/', <IntroPage />);
    const cta = await screen.findByRole('link', { name: 'Đăng nhập bằng hoandat.com' });
    expect(cta.getAttribute('href')).toBe('/auth/login?return=%2Ftao&lang=vi');
    expect(screen.getAllByRole('link', { name: /Đăng nhập/ })).toHaveLength(2); // the header pill and the ticket
    expect(document.querySelector('[data-id=public-sign-in]')?.getAttribute('href')).toBe('/login');
    expect(document.querySelector('[data-id=sign-in-card]')?.textContent).toContain('App không bao giờ thấy mật khẩu của bạn.');
    expect(document.querySelector('[data-id=intro-start]')).toBeNull();
    expect(document.querySelectorAll('#how [data-id^=feature-]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-id=intro] .template-card').length).toBeGreaterThan(0);
  });

  it('has its own header and footer: one theme, language in the header, the app belongs to hoandat.com', async () => {
    answerMe({ signedIn: false, signInAvailable: true });
    show('/', <IntroPage />);
    await screen.findByRole('link', { name: 'Đăng nhập bằng hoandat.com' });
    const header = document.querySelector('[data-id=app-header]');
    expect(header?.querySelector('[data-id=lang-switch]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Tiếng Việt' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-id=theme-switch]')).toBeNull();
    expect(document.querySelector('[class^=shell-]')).toBeNull();
    const home = screen.getByRole('link', { name: 'Một app của hoandat.com' });
    expect(home.getAttribute('href')).toBe('https://hoandat.com');
    expect(screen.getByRole('link', { name: 'Quyền riêng tư' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'Điều khoản' }).getAttribute('href')).toBe('/terms');
    expect(document.querySelector('[data-id=skip-link]')?.getAttribute('href')).toBe('#main');
    expect(document.querySelector('main#main')).not.toBeNull();
  });

  it('switches the language and keeps it in the shared cookie', async () => {
    answerMe({ signedIn: false, signInAvailable: true });
    show('/', <IntroPage />);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('link', { name: 'Sign in with hoandat.com' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'An app from hoandat.com' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('true');
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
  it('puts the sign-in ticket on /login, back to the page the visitor came from', async () => {
    answerMe({ signedIn: false, signInAvailable: true });
    show('/login?return=%2Fvideo', <LoginPage />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Đăng nhập để tạo video');
    expect(document.querySelector('[data-id=sign-in-cta]')?.getAttribute('href')).toBe('/auth/login?return=%2Fvideo&lang=vi');
    expect(document.querySelector('[data-id=public-sign-in]')?.getAttribute('aria-current')).toBe('page');
  });

  it('shows the account menu with the picture and name instead of sign-in, and signs out from it', async () => {
    const fetchMock = answerMe({
      signedIn: true,
      signInAvailable: true,
      name: 'Lan Anh',
      email: 'lan@example.com',
      picture: 'https://lh3.googleusercontent.com/a/abc',
    });
    show('/video', <p>Body</p>);
    const menu = await waitFor(() => {
      const element = document.querySelector('[data-id=app-header] [data-id=account-menu]');
      if (!element) throw new Error('no account menu yet');
      return element;
    });
    expect(document.querySelector('[data-id=public-sign-in]')).toBeNull();
    expect(document.querySelector('[data-id=nav-videos]')?.getAttribute('aria-current')).toBe('page');
    expect(menu.querySelector('[data-id=topbar-account] .shell-account-name')?.textContent).toBe('Lan Anh');
    const avatar = menu.querySelector('img.shell-avatar');
    expect(avatar?.getAttribute('src')).toBe('https://lh3.googleusercontent.com/a/abc');
    expect(avatar?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(menu.querySelector('.shell-account-head-email')?.textContent).toBe('lan@example.com');
    expect(menu.querySelector('[data-id=account-menu-idp-email]')?.getAttribute('href')).toBe('https://auth.hoandat.com/account#account-email');

    fireEvent.click(menu.querySelector('[data-id=account-menu-sign-out]') as HTMLElement);
    await screen.findByRole('link', { name: 'Đăng nhập' });
    expect(fetchMock).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({ method: 'POST' }));
    expect(document.querySelector('[data-id=account-menu]')).toBeNull();
  });

  it('shows the initial and a fallback name for an account that has not sent its profile yet', async () => {
    answerMe({ signedIn: true, signInAvailable: true });
    show('/video', <p>Body</p>);
    const trigger = await waitFor(() => {
      const element = document.querySelector('[data-id=topbar-account]');
      if (!element) throw new Error('no account menu yet');
      return element;
    });
    expect(trigger.querySelector('.shell-account-name')?.textContent).toBe('Tài khoản');
    expect(trigger.querySelector('img')).toBeNull();
    expect(trigger.querySelector('.shell-avatar-initial')?.getAttribute('data-initial')).toBe('T');
  });

  it('keeps both header links on every screen size, in one navigation', async () => {
    answerMe({ signedIn: true, signInAvailable: true, name: 'Lan Anh' });
    show('/tao', <p>Body</p>);
    await waitFor(() => {
      if (!document.querySelector('[data-id=account-menu]')) throw new Error('no account menu yet');
    });
    const nav = screen.getByRole('navigation', { name: 'Điều hướng' });
    expect(nav.querySelector('[data-id=nav-create]')?.getAttribute('href')).toBe('/tao');
    expect(nav.querySelector('[data-id=nav-create]')?.getAttribute('aria-current')).toBe('page');
    expect(nav.querySelector('[data-id=nav-videos]')?.getAttribute('href')).toBe('/video');
  });
});
