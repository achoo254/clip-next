import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '../account';
import { signedOut } from '../api';
import { I18nProvider } from '../i18n';
import { Layout } from '../layout';
import { GUIDE_PATHS, GUIDES } from '../seo/guide-pages';
import { GuidePage } from './guide-page';
import { IntroPage } from './intro-page';

/** A visitor: /api/me answers signed out. */
function stubSignedOut(): void {
  const body = signedOut(true);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })));
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

beforeEach(() => {
  document.cookie = 'hd_lang=vi; Path=/';
  stubSignedOut();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'hd_lang=; Max-Age=0; Path=/';
});

describe('guide pages in the app', () => {
  it('opens the birthday guide: tab title, calls to action and posters into /tao, the other guides', async () => {
    show(GUIDE_PATHS.birthday, <GuidePage guide={GUIDES.birthday} />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Làm video sinh nhật từ ảnh');
    expect(document.title).toBe('Làm video sinh nhật từ ảnh miễn phí, có nhạc và lời chúc · Clip');
    const ctas = screen.getAllByRole('link', { name: 'Làm video sinh nhật' });
    expect(ctas.map((link) => link.getAttribute('href'))).toEqual(['/tao?t=chuc-mung', '/tao?t=chuc-mung']);
    const posters = within(screen.getByRole('region', { name: 'Mẫu hợp cho sinh nhật' })).getAllByRole('link');
    expect(posters.map((link) => link.getAttribute('href'))).toEqual(['/tao?t=chuc-mung', '/tao?t=day-thang', '/tao?t=mung-tho']);
    const related = within(screen.getByRole('navigation', { name: 'Gợi ý khác' }));
    expect(related.getByRole('link', { name: 'Làm video dọc từ ảnh cho TikTok, Reels' }).getAttribute('href')).toBe(GUIDE_PATHS.vertical);
    expect(related.getByRole('link', { name: 'Video chúc Tết 2027' }).getAttribute('href')).toBe(GUIDE_PATHS.tet);
    expect(related.getByRole('link', { name: 'Xem tất cả mẫu video' }).getAttribute('href')).toBe('/mau');
  });

  it('keeps the guide in Vietnamese for an English visitor, the frame in English', async () => {
    document.cookie = 'hd_lang=en; Path=/';
    show(GUIDE_PATHS.tet, <GuidePage guide={GUIDES.tet} />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Video chúc Tết 2027');
    expect(document.querySelector('[data-id="guide-tet"]')?.getAttribute('lang')).toBe('vi');
    expect(screen.getByRole('link', { name: 'Create' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Làm video chúc Tết' })[0]?.getAttribute('href')).toBe('/tao?t=tet');
  });

  it('leads the vertical-video guide to the quick-list template', async () => {
    show(GUIDE_PATHS.vertical, <GuidePage guide={GUIDES.vertical} />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Làm video dọc từ ảnh cho TikTok, Reels');
    expect(screen.getAllByRole('link', { name: 'Làm video dọc ngay' })[0]?.getAttribute('href')).toBe('/tao?t=ke-nhanh');
  });

  it('links the intro page to the three guides', async () => {
    show('/', <IntroPage />);
    const ideas = within(await screen.findByRole('region', { name: 'Bạn đang cần' }));
    expect(ideas.getByRole('link', { name: 'Làm video sinh nhật từ ảnh' }).getAttribute('href')).toBe(GUIDE_PATHS.birthday);
    expect(ideas.getByRole('link', { name: 'Làm video dọc từ ảnh cho TikTok, Reels' }).getAttribute('href')).toBe(GUIDE_PATHS.vertical);
    expect(ideas.getByRole('link', { name: 'Video chúc Tết 2027' }).getAttribute('href')).toBe(GUIDE_PATHS.tet);
  });
});
