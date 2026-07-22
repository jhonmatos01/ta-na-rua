import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { setAccessToken, setRefreshHandler } from '../../lib/auth-session';
import {
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
  updateMyProfile,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from './auth-api';
import type { AuthUser } from './auth-contracts';

type AuthStatus = 'anonymous' | 'authenticated' | 'loading';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login(input: LoginInput): Promise<AuthUser>;
  register(input: RegisterInput): Promise<AuthUser>;
  logout(): Promise<void>;
  updateProfile(input: UpdateProfileInput): Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const sessionRecoveryPromise = useRef<ReturnType<typeof refreshSession> | null>(null);

  const applySession = useCallback((accessToken: string, sessionUser: AuthUser) => {
    setAccessToken(accessToken);
    setUser(sessionUser);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const recover = async (): Promise<string | null> => {
      try {
        sessionRecoveryPromise.current ??= refreshSession().finally(() => {
          sessionRecoveryPromise.current = null;
        });
        const response = await sessionRecoveryPromise.current;
        if (cancelled) return null;
        applySession(response.data.accessToken, response.data.user);
        return response.data.accessToken;
      } catch {
        if (!cancelled) clearSession();
        return null;
      }
    };

    setRefreshHandler(recover);
    void recover();
    return () => {
      cancelled = true;
      setRefreshHandler(null);
      setAccessToken(null);
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await loginRequest(input);
      applySession(response.data.accessToken, response.data.user);
      return response.data.user;
    },
    [applySession],
  );

  const register = useCallback((input: RegisterInput) => registerRequest(input), []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // A sessão local precisa terminar mesmo quando a API estiver indisponível.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const updated = await updateMyProfile(input);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout, updateProfile }),
    [status, user, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
