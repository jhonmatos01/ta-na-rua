import { NavLink, Outlet } from 'react-router-dom';

import { BrandMark } from '../components/brand-mark';
import { env } from '../config/env';

function navClass({ isActive }: { isActive: boolean }): string {
  return `relative rounded-xl px-3.5 py-2.5 text-sm font-extrabold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
  }`;
}

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-slate-900">
      <a
        href="#conteudo-principal"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-xl bg-ink px-4 py-3 font-bold text-white shadow-lg transition focus:translate-y-0"
      >
        Ir para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <NavLink
            to="/"
            className="rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          >
            <BrandMark />
          </NavLink>
          <nav aria-label="Navegação principal" className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Início
            </NavLink>
            <NavLink to="/status" className={navClass}>
              Status
            </NavLink>
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
              <p className="mt-0.5 text-slate-500">Aplicação cidadã em construção responsável.</p>
            </div>
          </div>
          <div className="text-slate-500 sm:text-right">
            <p>Versão {env.appVersion} · Fundação FE‑0</p>
            <p className="mt-1 text-xs">
              Privacidade, acessibilidade e transparência desde a base.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
