import type { ReactNode } from 'react';
import { brand } from './brand';
import { useI18n } from './i18n';

interface Props {
  /** Where the call to action goes: the server's route to the account service (see signInUrl). */
  readonly signInHref: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** 1 on its own page (/login); 2 beside or under a page title. */
  readonly headingLevel?: 1 | 2;
  /** Under the note, e.g. "sign-in is not available right now". */
  readonly children?: ReactNode;
}

/**
 * The sign-in card, drawn as a cinema ticket: the title and the one call to action, "Sign in with hoandat.com", on
 * the ticket, and on the stub below the perforation how the account page signs people in. No "create account":
 * the account page creates the account. The call to action is a plain link, never the router: it leaves the app.
 */
export function SignInTicket({ signInHref, title, description, headingLevel = 2, children }: Props): ReactNode {
  const { t } = useI18n();
  const domain = brand.primaryTenant.domain;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section className="ticket" data-id="sign-in-card">
      <div className="ticket-main">
        <Heading className="ticket-title">{title}</Heading>
        {description === undefined ? null : <p className="ticket-sub">{description}</p>}
        <a className="btn btn-primary btn-lg ticket-cta" href={signInHref} data-id="sign-in-cta">
          {t('chrome.signInWith', { domain })}
        </a>
      </div>
      <div className="ticket-stub">
        <p className="ticket-note">{t('chrome.signInNote', { domain })}</p>
        {children}
      </div>
    </section>
  );
}
