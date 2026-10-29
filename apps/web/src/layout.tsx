import { AccountMenu } from '@achoo254/app-shell';
import { writePreference } from '@achoo254/app-shell/preferences';
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import type { Locale } from '@clip/templates';
import { LOGIN_PATH, loginPageHref } from './api';
import { useAccount } from './account';
import { brand, HOME_URL } from './brand';
import { LOCALES, useI18n } from './i18n';

/** Each language in its own words, never translated; the switch shows the short code. */
const LOCALE_NAMES: Readonly<Record<Locale, string>> = { vi: 'Tiếng Việt', en: 'English' };

/** Path plus query of the current page: where sign-in comes back to. */
export function useHere(): string {
  const location = useLocation();
  return `${location.pathname}${location.search}`;
}

/**
 * The language switch: one button per language of the app. A pick is stored in the cookie shared by every
 * hoandat.com app (`hd_lang`), so the next app opens in it too.
 */
function LanguageSwitch(): ReactNode {
  const { t, locale, setLocale } = useI18n();
  return (
    <fieldset className="lang-switch" data-id="lang-switch">
      <legend className="visually-hidden">{t('chrome.language')}</legend>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className="lang-option"
          lang={option}
          aria-label={LOCALE_NAMES[option]}
          title={LOCALE_NAMES[option]}
          aria-pressed={option === locale}
          onClick={() => {
            writePreference('lang', option, { domain: brand.primaryTenant.domain });
            setLocale(option);
          }}
          data-id={`lang-${option}`}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </fieldset>
  );
}

/** The account pages of the account service, which the menu links to in a new tab. */
const IDP_ACCOUNT_URL = `${brand.primaryTenant.issuer}/account`;

/**
 * Signed in: the shared account menu (picture or initial and name; sign-out inside). Signed out: the sign-in pill to
 * /login, unless sign-in is not configured on this server.
 */
function AccountControl(): ReactNode {
  const { t, locale } = useI18n();
  const { me, signOut } = useAccount();
  const { pathname } = useLocation();
  const here = useHere();
  const [signingOut, setSigningOut] = useState(false);
  if (me?.signedIn === true) {
    return (
      <AccountMenu
        user={{ name: me.name, email: me.email, picture: me.picture }}
        locale={locale}
        domain={brand.primaryTenant.domain}
        idpAccountUrl={IDP_ACCOUNT_URL}
        signOut={{
          busy: signingOut,
          onClick: () => {
            setSigningOut(true);
            void signOut().finally(() => setSigningOut(false));
          },
        }}
      />
    );
  }
  // Still checking, or no sign-in here: no pill that would only come back with "not available".
  if (me === null || !me.signInAvailable) return null;
  return (
    <Link
      to={loginPageHref(here)}
      className="header-pill header-pill-cta"
      aria-current={pathname === LOGIN_PATH ? 'page' : undefined}
      data-id="public-sign-in"
    >
      {t('chrome.signIn')}
    </Link>
  );
}

function Header(): ReactNode {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const links = [
    { to: '/tao', label: t('nav.create'), dataId: 'nav-create' },
    { to: '/video', label: t('nav.videos'), dataId: 'nav-videos' },
  ] as const;
  return (
    <header className="site-header" data-id="app-header">
      <div className="site-header-inner container">
        <Link to="/" className="brand" data-id="home">
          <img className="brand-mark" src="/clip-mark-128.webp" width="40" height="40" alt="" />
          <span className="brand-name">{brand.appName}</span>
        </Link>
        <nav className="site-nav" aria-label={t('chrome.nav')}>
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="nav-link" aria-current={pathname === link.to ? 'page' : undefined} data-id={link.dataId}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-end">
          <LanguageSwitch />
          <AccountControl />
        </div>
      </div>
      <div className="marquee-lights" aria-hidden="true" />
    </header>
  );
}

function Footer(): ReactNode {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const links = [
    { to: '/privacy', label: t('chrome.privacy'), dataId: 'foot-privacy' },
    { to: '/terms', label: t('chrome.terms'), dataId: 'foot-terms' },
    { to: '/mau', label: t('foot.templates'), dataId: 'foot-templates' },
    { to: '/credits', label: t('foot.credits'), dataId: 'foot-credits' },
  ] as const;
  return (
    <footer className="site-footer" data-id="app-footer">
      <div className="site-footer-inner container">
        <p className="footer-brand" aria-hidden="true">
          <img src="/clip-mark-128.webp" width="32" height="32" alt="" />
          <span>{brand.appName}</span>
        </p>
        <nav className="footer-links" aria-label={t('chrome.footLinks')}>
          <a className="footer-link footer-home" href={HOME_URL} data-id="foot-home">
            {t('chrome.ecosystem', { domain: brand.primaryTenant.domain })}
          </a>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="footer-link"
              aria-current={pathname === link.to || (link.to === '/mau' && pathname.startsWith('/mau/')) ? 'page' : undefined}
              data-id={link.dataId}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
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
 * Every page, signed out or in: Clip's own cinema chrome (marquee header with the language switch, credits-roll
 * footer saying the app belongs to hoandat.com) around the page. /login centres its ticket instead.
 */
export function Layout({ children }: { readonly children: ReactNode }): ReactNode {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const onLogin = pathname === LOGIN_PATH;
  return (
    <div className="site">
      <a className="skip-link" href="#main" data-id="skip-link">
        {t('chrome.skip')}
      </a>
      <Header />
      {/* Focusable by the skip link only, not in the tab order. */}
      <main id="main" tabIndex={-1} className={onLogin ? 'site-main site-main-center container' : 'site-main container'}>
        {onLogin ? (
          children
        ) : (
          <div className="page stack-lg">
            <LoginNotice />
            {children}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
