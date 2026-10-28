import { SignInCard } from '@achoo254/app-shell';
import { useEffect, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { safeReturnPath, signInUrl } from '../api';
import { useAccount } from '../account';
import { useI18n } from '../i18n';
import { SHELL_BRAND } from '../layout';

/**
 * /login, where the header's sign-in pill goes: the shared sign-in card. Its link is the server's route to the
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
    <SignInCard brand={SHELL_BRAND} locale={locale} signInHref={signInUrl(returnTo, locale)} title={t('signIn.title')} description={t('signIn.lead')}>
      {me !== null && !me.signInAvailable ? (
        <p className="alert alert-warning" role="status" data-id="sign-in-unavailable">
          {t('auth.unavailable')}
        </p>
      ) : null}
    </SignInCard>
  );
}
