import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './auth-context';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return (
      <section className="mx-auto grid min-h-[50vh] w-full max-w-7xl place-items-center px-4 py-16">
        <div className="text-center" role="status">
          <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
          <p className="mt-4 font-bold text-slate-600">Recuperando sua sessão...</p>
        </div>
      </section>
    );
  }

  if (auth.status === 'anonymous') {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
