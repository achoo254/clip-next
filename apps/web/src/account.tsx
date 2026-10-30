import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMe, signOut as apiSignOut, signedOut, type Me } from './api';

interface Account {
  /** Null while the first check runs. */
  readonly me: Me | null;
  signOut(): Promise<void>;
}

const AccountContext = createContext<Account | null>(null);

/** Whether this browser is signed in (from /api/me), shared by the header and the pages. */
export function AccountProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let live = true;
    getMe()
      .then((value) => {
        if (live) setMe(value);
      })
      .catch(() => {
        if (live) setMe(signedOut(false));
      });
    return () => {
      live = false;
    };
  }, []);
  const signOut = useCallback(async () => {
    await apiSignOut().catch(() => null);
    setMe((current) => signedOut(current?.signInAvailable ?? true, current?.voiceAvailable ?? false));
  }, []);
  const value = useMemo(() => ({ me, signOut }), [me, signOut]);
  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount(): Account {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount outside AccountProvider');
  return value;
}
