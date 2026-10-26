import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router';
import { signInUrl } from './api';
import { useAccount } from './account';
import { brand, HOME_URL } from './brand';
import { LOCALE_NAMES, LOCALES, useI18n } from './i18n';

/** Path plus query of the current page: where sign-in comes back to. */
export function useHere(): string {
  const location = useLocation();
  return `${location.pathname}${location.search}`;
}

function LanguageSwitch(): ReactNode {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')} data-id="lang-switch">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className="lang-option"
          lang={code}
          aria-pressed={code === locale}
          onClick={() => setLocale(code)}
          data-id={`lang-${code}`}
        >
          {LOCALE_NAMES[code]}
        </button>
      ))}
    </div>
  );
}

function AccountButton(): ReactNode {
  const { me, signOut } = useAccount();
  const { t, locale } = useI18n();
  const here = useHere();
  if (!me) return null;
  if (me.signedIn) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => void signOut()} data-id="sign-out">
        {t('auth.signOut')}
      </button>
    );
  }
  return (
    <a className="btn btn-primary" href={signInUrl(here, locale)} data-id="sign-in">
      {t('auth.signIn')}
    </a>
  );
}

/** A notice when sign-in came back failed or unavailable (`?login=` from the server). */
function LoginNotice(): ReactNode {
  const [params] = useSearchParams();
  const { t } = useI18n();
  const login = params.get('login');
  if (login !== 'fail' && login !== 'unavailable') return null;
  return (
    <p className="alert alert-warning container" role="status" data-id="login-notice">
      {t(login === 'fail' ? 'auth.failed' : 'auth.unavailable')}
    </p>
  );
}

/** The page frame every app of the ecosystem shares: header with mark, name, nav and account; footer links. */
export function Layout({ children }: { readonly children: ReactNode }): ReactNode {
  const { t } = useI18n();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner container">
          <Link className="app-brand" to="/" data-id="app-brand">
            <img className="app-brand-mark" src="/clip-mark-128.webp" width="28" height="28" alt="" aria-hidden="true" />
            <b>{brand.appName}</b>
          </Link>
          <nav className="topbar-nav" aria-label={t('nav.main')}>
            <NavLink className="topbar-link" to="/tao" data-id="nav-create">
              {t('nav.create')}
            </NavLink>
            <NavLink className="topbar-link" to="/video" data-id="nav-videos">
              {t('nav.videos')}
            </NavLink>
          </nav>
          <div className="topbar-actions">
            <LanguageSwitch />
            <AccountButton />
          </div>
        </div>
      </header>
      <LoginNotice />
      <main className="page container">{children}</main>
      <footer className="page-foot container">
        <p className="foot-links">
          <a className="foot-link" href={HOME_URL} data-id="foot-home">
            {t('foot.ecosystem', { domain: brand.primaryTenant.domain })}
          </a>
          <Link className="foot-link" to="/privacy" data-id="foot-privacy">
            {t('foot.privacy')}
          </Link>
          <Link className="foot-link" to="/terms" data-id="foot-terms">
            {t('foot.terms')}
          </Link>
          <Link className="foot-link" to="/credits" data-id="foot-credits">
            {t('foot.credits')}
          </Link>
        </p>
      </footer>
    </>
  );
}
