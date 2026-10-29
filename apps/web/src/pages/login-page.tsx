import { useEffect, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { safeReturnPath, signInUrl } from '../api';
import { useAccount } from '../account';
import { useI18n } from '../i18n';
import { SignInTicket } from '../sign-in-ticket';

/**
 * /login, where the header's sign-in pill goes: the mascot over the sign-in ticket. Its link is the server's route to the
 * account service, back to the page the visitor came from (`?return=`).
 */
export function LoginPage(): ReactNode {
  const { t, locale } = useI18n();
  const { me } = useAccount();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = safeReturnPath(params.get('return'));

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (me?.signedIn === true) void navigate(returnTo, { replace: true });
  }, [me, navigate, returnTo]);

  return (
    <div className="login" data-id="login">
      <img className="login-mascot" src="/clip-mascot-384.webp" width="192" height="192" alt="" />
      <SignInTicket signInHref={signInUrl(returnTo, locale)} title={t('signIn.title')} description={t('signIn.lead')} headingLevel={1}>
        {me !== null && !me.signInAvailable ? (
          <p className="alert alert-warning" role="status" data-id="sign-in-unavailable">
            {t('auth.unavailable')}
          </p>
        ) : null}
      </SignInTicket>
    </div>
  );
}
