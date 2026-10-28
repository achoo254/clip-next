import { PublicPage, type ShellBrand, type ShellLink, type ShellLinkComponent } from '@achoo254/app-shell';
import type { ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { LOGIN_PATH, loginPageHref } from './api';
import { useAccount } from './account';
import { brand } from './brand';
import { LOCALES, isLocale, useI18n } from './i18n';

/** The app as the shared shell names it; the mark is the AI-drawn one in apps/web/public (pnpm brand:gen). */
export const SHELL_BRAND: ShellBrand = { appName: brand.appName, domain: brand.primaryTenant.domain, markSrc: '/clip-mark-128.webp' };

/** Links to the app's own pages go through the router, without reloading the page. */
const RouterLink: ShellLinkComponent = ({ href, ...rest }) => <Link to={href} {...rest} />;

/** Path plus query of the current page: where sign-in comes back to. */
export function useHere(): string {
  const location = useLocation();
  return `${location.pathname}${location.search}`;
}

/** The sign-out control in the header's place of the sign-in pill, styled as the header's links. */
function SignOutButton(): ReactNode {
  const { signOut } = useAccount();
  const { t } = useI18n();
  return (
    <button type="button" className="shell-topbar-link topbar-button" onClick={() => void signOut()} data-id="sign-out">
      {t('auth.signOut')}
    </button>
  );
}

/** A notice when sign-in came back failed or unavailable (`?login=` from the server). */
function LoginNotice(): ReactNode {
  const [params] = useSearchParams();
  const { t } = useI18n();
  const login = params.get('login');
  if (login !== 'fail' && login !== 'unavailable') return null;
  return (
    <p className="alert alert-warning" role="status" data-id="login-notice">
      {t(login === 'fail' ? 'auth.failed' : 'auth.unavailable')}
    </p>
  );
}

/**
 * Every page, signed out or in: the header, frame and footer of every hoandat.com app (@achoo254/app-shell),
 * with the language and theme switches in the footer, around the page.
 */
export function Layout({ children }: { readonly children: ReactNode }): ReactNode {
  const { t, locale, setLocale } = useI18n();
  const { me } = useAccount();
  const { pathname } = useLocation();
  const here = useHere();
  const onLogin = pathname === LOGIN_PATH;
  const navLinks: ShellLink[] = [
    // Phones have room for the name and two controls; the mark and name open the create page once signed in.
    { href: '/tao', label: t('nav.create'), dataId: 'nav-create', current: pathname === '/tao', hideOnPhones: true },
    { href: '/video', label: t('nav.videos'), dataId: 'nav-videos', current: pathname === '/video' },
  ];
  const footerLinks: ShellLink[] = [
    { href: '/mau', label: t('foot.templates'), dataId: 'foot-templates', current: pathname.startsWith('/mau') },
    { href: '/credits', label: t('foot.credits'), dataId: 'foot-credits', current: pathname === '/credits' },
  ];
  let accountSlot: ReactNode;
  if (me?.signedIn === true) accountSlot = <SignOutButton />;
  // Sign-in is not configured on this server: no pill that would only come back with "not available".
  else if (me !== null && !me.signInAvailable) accountSlot = <></>;

  return (
    <PublicPage
      brand={SHELL_BRAND}
      locale={locale}
      locales={LOCALES}
      onLocaleChange={(next) => {
        if (isLocale(next)) setLocale(next);
      }}
      signInHref={loginPageHref(here)}
      signInCurrent={onLogin}
      navLinks={navLinks}
      accountSlot={accountSlot}
      footerLinks={footerLinks}
      linkComponent={RouterLink}
      layout={onLogin ? 'center' : 'flow'}
    >
      {onLogin ? (
        children
      ) : (
        <div className="page stack-lg">
          <LoginNotice />
          {children}
        </div>
      )}
    </PublicPage>
  );
}
