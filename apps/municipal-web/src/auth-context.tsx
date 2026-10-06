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

import {
  ApiError,
  isOperationalRole,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  setAccessToken,
  setRefreshHandler,
  type SessionUser,
} from './api';

type AuthStatus = 'anonymous' | 'authenticated' | 'loading';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recoveryPromise = useRef<ReturnType<typeof refreshSession> | null>(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const applySession = useCallback(
    (token: string, sessionUser: SessionUser) => {
      if (!isOperationalRole(sessionUser.role)) {
        clearSession();
        setError('Este painel é exclusivo para equipes autorizadas da gestão municipal.');
        return false;
      }
      setAccessToken(token);
      setUser(sessionUser);
      setStatus('authenticated');
      setError(null);
      return true;
    },
    [clearSession],
  );

  useEffect(() => {
    let cancelled = false;
    const recover = async (): Promise<string | null> => {
      try {
        recoveryPromise.current ??= refreshSession().finally(() => {
          recoveryPromise.current = null;
        });
        const response = await recoveryPromise.current;
        if (cancelled) return null;
        if (applySession(response.data.accessToken, response.data.user)) {
          return response.data.accessToken;
        }
        try {
          await logoutRequest();
        } catch {
          // A sessão sem perfil operacional já foi descartada no navegador.
        }
        return null;
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
    async (email: string, password: string) => {
      setError(null);
      try {
        const response = await loginRequest(email, password);
        if (!applySession(response.data.accessToken, response.data.user)) {
          try {
            await logoutRequest();
          } catch {
            // O token em memória já foi descartado.
          }
        }
      } catch (caught) {
        clearSession();
        if (caught instanceof ApiError && caught.status === 401) {
          setError('E-mail ou senha inválidos.');
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Não foi possível entrar no painel.');
      }
    },
    [applySession, clearSession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // A sessão local termina mesmo se a API estiver indisponível.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const clearError = useCallback(() => setError(null), []);
  const value = useMemo(
    () => ({ status, user, error, login, logout, clearError }),
    [status, user, error, login, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
