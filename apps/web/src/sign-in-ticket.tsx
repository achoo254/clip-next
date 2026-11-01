import type { ReactNode } from 'react';
import { signInUrl } from './api';
import { brand } from './brand';
import { useI18n } from './i18n';

interface Props {
  /** The page of this app to come back to after the account service. */
  readonly returnTo: string;
  /**
   * Whom the ticket is for: `sign-in` (the default) leads with "Sign in with hoandat.com" and offers making an
   * account below; `sign-up` invites a guest to make a free account first and offers sign-in below.
   */
  readonly invite?: 'sign-in' | 'sign-up';
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** 1 on its own page (/login); 2 beside or under a page title. */
  readonly headingLevel?: 1 | 2;
  /** Under the note, e.g. "sign-in is not available right now". */
  readonly children?: ReactNode;
}

/**
 * The sign-in card, drawn as a cinema ticket: the title and the one call to action on the ticket, and on the stub
 * below the perforation how the account service signs people in plus the other way in (sign up / sign in). Sign-up
 * links open the account service on "create account" (see signInUrl). The links are plain links, never the router:
 * they leave the app.
 */
export function SignInTicket({ returnTo, invite = 'sign-in', title, description, headingLevel = 2, children }: Props): ReactNode {
  const { t, locale } = useI18n();
  const domain = brand.primaryTenant.domain;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const signUp = invite === 'sign-up';
  return (
    <section className="ticket" data-id="sign-in-card">
      <div className="ticket-main">
        <Heading className="ticket-title">{title}</Heading>
        {description === undefined ? null : <p className="ticket-sub">{description}</p>}
        <a className="btn btn-primary btn-lg ticket-cta" href={signInUrl(returnTo, locale, signUp)} data-id={signUp ? 'sign-up-cta' : 'sign-in-cta'}>
          {t(signUp ? 'chrome.signUpWith' : 'chrome.signInWith', { domain })}
        </a>
      </div>
      <div className="ticket-stub">
        <p className="ticket-note">{t(signUp ? 'chrome.signUpNote' : 'chrome.signInNote', { domain })}</p>
        <p className="ticket-note">
          <a href={signInUrl(returnTo, locale, !signUp)} data-id={signUp ? 'sign-in-link' : 'sign-up-link'}>
            {t(signUp ? 'chrome.haveAccount' : 'chrome.noAccount')}
          </a>
        </p>
        {children}
      </div>
    </section>
  );
}
