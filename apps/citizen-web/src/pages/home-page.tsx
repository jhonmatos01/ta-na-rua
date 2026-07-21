import { Link } from 'react-router-dom';

import { CityMapPreview } from '../components/city-map-preview';
import { StatusBadge, type ServiceState } from '../components/status-badge';
import { env } from '../config/env';
import { useAuth } from '../features/auth/auth-context';
import { useApiHealth } from '../features/status/health-queries';
import { getSafeErrorMessage } from '../lib/api-error';

function getState(enabled: boolean, isPending: boolean, isError: boolean): ServiceState {
  if (!enabled) return 'disabled';
  if (isPending) return 'loading';
  if (isError) return 'unavailable';
  return 'available';
}

const journeys = [
  {
    number: '01',
    title: 'Relatar com simplicidade',
    description:
      'Foto, categoria revisável e localização confirmada pelo cidadão em um fluxo guiado.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M4 7h3l1.5-2h7L17 7h3v12H4Z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Acompanhar com clareza',
    description: 'Protocolo, status e linha do tempo públicos sem expor informações pessoais.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M5 4h14v16H5Z" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Participar da solução',
    description:
      'Confirmações comunitárias fortalecem o relato sem criar duplicidades automáticas.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="10" r="2" />
        <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 15c3 0 5 1.8 5 5" />
      </svg>
    ),
  },
];

export function HomePage() {
  const auth = useAuth();
  const apiHealth = useApiHealth();
  const serviceState = getState(env.enableApiStatus, apiHealth.isPending, apiHealth.isError);

  return (
    <>
      <section className="relative overflow-hidden bg-white">
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute -left-32 top-28 size-80 rounded-full bg-brand-100/60 blur-3xl"
          aria-hidden="true"
        />
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:py-24">
          <div className="relative z-10 min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-700">
              <span className="size-2 rounded-full bg-brand-600" aria-hidden="true" />
              FE‑1 · Conta cidadã
            </p>
            <h1 className="mt-6 max-w-2xl text-5xl font-black leading-[1.03] tracking-[-0.055em] text-ink sm:text-6xl">
              Sua cidade. <span className="text-brand-600">Mais próxima.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Crie sua conta com segurança e prepare-se para acompanhar e participar do cuidado com
              a cidade em um só lugar.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={auth.status === 'authenticated' ? '/perfil' : '/criar-conta'}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-extrabold text-white shadow-brand transition hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {auth.status === 'authenticated' ? 'Abrir meu perfil' : 'Criar conta cidadã'}
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
              <Link
                to={auth.status === 'authenticated' ? '/status' : '/entrar'}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {auth.status === 'authenticated' ? 'Ver status dos serviços' : 'Já tenho conta'}
              </Link>
            </div>

            <aside
              className="mt-8 flex max-w-xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:flex-row sm:items-center"
              aria-labelledby="status-resumo"
            >
              <span
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 12h3l2-5 4 10 2-5h5" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="status-resumo" className="font-extrabold text-ink">
                    API do projeto
                  </h2>
                  <StatusBadge state={serviceState} />
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {apiHealth.isError
                    ? getSafeErrorMessage(apiHealth.error)
                    : 'Contrato público de saúde verificado em tempo real.'}
                </p>
              </div>
              <Link
                to="/status"
                className="shrink-0 text-sm font-extrabold text-brand-700 hover:text-brand-800"
              >
                Detalhes
              </Link>
            </aside>
          </div>

          <CityMapPreview />
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-canvas" aria-labelledby="jornadas-title">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
                Próximas jornadas
              </p>
              <h2
                id="jornadas-title"
                className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl"
              >
                Do relato à solução, sem ruído.
              </h2>
            </div>
            <p className="max-w-2xl leading-7 text-slate-600 lg:justify-self-end">
              Estas jornadas fazem parte da direção visual aprovada. Elas serão ativadas
              gradualmente, com contratos, privacidade e testes próprios em cada fase.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {journeys.map((journey) => (
              <article
                key={journey.number}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-floating"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                    {journey.icon}
                  </span>
                  <span className="text-sm font-black text-slate-300">{journey.number}</span>
                </div>
                <h3 className="mt-8 text-xl font-black tracking-tight text-ink">{journey.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{journey.description}</p>
                <p className="mt-6 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-600">
                  Planejado
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white" aria-labelledby="fundacao-title">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">
              Fundação confiável
            </p>
            <h2
              id="fundacao-title"
              className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink"
            >
              Moderna por fora. Sólida por dentro.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Responsiva', 'Celular, tablet e computador com a mesma clareza.'],
              ['Validada', 'Respostas da API conferidas antes de chegar à tela.'],
              ['Acessível', 'Teclado, foco visível, contraste e HTML semântico.'],
            ].map(([title, description]) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-canvas p-5">
                <span className="mb-4 block h-1 w-8 rounded-full bg-brand-600" aria-hidden="true" />
                <h3 className="font-black text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
