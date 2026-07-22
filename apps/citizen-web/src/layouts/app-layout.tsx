import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { BrandMark } from '../components/brand-mark';
import { env } from '../config/env';
import { useAuth } from '../features/auth/auth-context';

function navClass({ isActive }: { isActive: boolean }): string {
  return `relative inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-extrabold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
  }`;
}

export function AppLayout() {
  const auth = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await auth.logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-slate-900">
      <a
        href="#conteudo-principal"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-xl bg-ink px-4 py-3 font-bold text-white shadow-lg transition focus:translate-y-0"
      >
        Ir para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <NavLink
            to="/"
            className="shrink-0 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          >
            <BrandMark />
          </NavLink>
          <nav
            aria-label="Navegação principal"
            className="flex min-w-0 items-center justify-end gap-1"
          >
            <span className="hidden sm:block">
              <NavLink to="/mapa" className={navClass} aria-label="Abrir mapa público">
                <svg
                  viewBox="0 0 24 24"
                  className="size-5 sm:mr-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="m4 5 5-2 6 2 5-2v16l-5 2-6-2-5 2Z" />
                  <path d="M9 3v16M15 5v16" />
                </svg>
                <span>Mapa</span>
              </NavLink>
            </span>
            <span className="hidden md:block">
              <NavLink to="/status" className={navClass}>
                Status
              </NavLink>
            </span>
            {auth.status === 'authenticated' ? (
              <>
                <NavLink
                  to="/nova-ocorrencia"
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${isActive ? 'ring-3 ring-brand-200' : ''}`
                  }
                  aria-label="Registrar novo problema"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5 sm:mr-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="hidden sm:inline">Reportar</span>
                </NavLink>
                <NavLink to="/perfil" className={navClass} aria-label="Abrir meu perfil">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5 sm:mr-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c0-4 2.6-6 7-6s7 2 7 6" />
                  </svg>
                  <span className="hidden sm:inline">Perfil</span>
                </NavLink>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-extrabold text-slate-600 transition hover:bg-slate-100 hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
                  aria-label="Sair da conta"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5 sm:mr-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
                  </svg>
                  <span className="hidden sm:inline">{loggingOut ? 'Saindo...' : 'Sair'}</span>
                </button>
              </>
            ) : auth.status === 'anonymous' ? (
              <>
                <NavLink to="/entrar" className={navClass}>
                  Entrar
                </NavLink>
                <NavLink
                  to="/criar-conta"
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${isActive ? 'ring-3 ring-brand-200' : ''}`
                  }
                  aria-label="Criar conta"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5 sm:mr-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="hidden sm:inline">Criar conta</span>
                </NavLink>
              </>
            ) : (
              <span
                className="h-11 w-24 animate-pulse rounded-xl bg-slate-100"
                aria-label="Verificando sessão"
              />
            )}
          </nav>
        </div>
      </header>

      <main id="conteudo-principal" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 text-sm sm:grid-cols-[1fr_auto] sm:items-center sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark compact />
            <div>
              <p className="font-extrabold text-ink">Tá na Rua!</p>
              <p className="mt-0.5 text-slate-500">Participação cidadã com segurança.</p>
            </div>
          </div>
          <div className="text-slate-500 sm:text-right">
            <p>Versão {env.appVersion} · Fase FE‑4</p>
            <p className="mt-1 text-xs">Registro, confirmação comunitária e acompanhamento.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
