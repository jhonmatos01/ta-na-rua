import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  getDashboard,
  type CategoryItem,
  type DashboardSummary,
  type RankingItem,
} from './api';
import { useAuth } from './auth-context';
import { OperationsPage } from './operations-page';

type MunicipalView = 'occurrences' | 'overview';

function currentMunicipalView(): MunicipalView {
  return new URLSearchParams(window.location.search).get('view') === 'occurrences'
    ? 'occurrences'
    : 'overview';
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <path d="M24 3 8 9v12c0 10 6.8 19.2 16 24 9.2-4.8 16-14 16-24V9L24 3Z" />
          <path d="M15 25h4v7h-4zm7-9h4v16h-4zm7 5h4v11h-4z" />
        </svg>
      </span>
      <span>
        <strong>Tá na Rua!</strong>
        {!compact && <small>Gestão municipal</small>}
      </span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="center-screen" aria-live="polite">
      <Brand />
      <span className="loader" aria-hidden="true" />
      <p>Restaurando acesso seguro…</p>
    </main>
  );
}

function LoginPage() {
  const { error, login, clearError } = useAuth();
  const [email, setEmail] = useState('bruno.operador@example.test');
  const [password, setPassword] = useState('Operador123!Fase2');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    await login(email.trim(), password);
    setSubmitting(false);
  }

  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="login-story__copy">
          <span className="eyebrow">Operação urbana orientada por dados</span>
          <h1>Da ocorrência à ação, com toda a cidade à vista.</h1>
          <p>
            Priorize atendimentos, acompanhe resultados e transforme a participação cidadã em
            decisões claras para a equipe municipal.
          </p>
        </div>
        <div className="login-story__metrics" aria-label="Benefícios do painel">
          <span>
            <strong>Tempo real</strong>
            <small>Visão operacional</small>
          </span>
          <span>
            <strong>Um só fluxo</strong>
            <small>Do registro à solução</small>
          </span>
          <span>
            <strong>Auditável</strong>
            <small>Histórico preservado</small>
          </span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={(event) => void handleSubmit(event)}>
          <span className="eyebrow">Acesso da prefeitura</span>
          <h2>Bem-vindo de volta</h2>
          <p>Entre com uma conta operacional autorizada.</p>

          <label>
            E-mail institucional
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError();
              }}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearError();
              }}
              required
            />
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Verificando acesso…' : 'Entrar no painel'}
          </button>
          <p className="privacy-note">
            O token de acesso fica somente na memória do navegador. A renovação usa cookie seguro
            gerenciado pela API.
          </p>
        </form>
      </section>
    </main>
  );
}

const statusLabels: Record<string, string> = {
  PENDING_REVIEW: 'Em revisão',
  PUBLISHED: 'Publicada',
  FORWARDED: 'Encaminhada',
  IN_PROGRESS: 'Em atendimento',
  RESOLVED: 'Resolvida',
  CLOSED: 'Encerrada',
  CONTESTED: 'Contestada',
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'green' | 'orange' | 'red';
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__icon" aria-hidden="true" />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<MunicipalView>(currentMunicipalView);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboard();
      setSummary(data.summary);
      setRanking(data.ranking);
      setCategories(data.categories);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadDashboard]);

  useEffect(() => {
    const handleHistory = () => setView(currentMunicipalView());
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, []);

  function navigate(viewToOpen: MunicipalView) {
    setView(viewToOpen);
    const nextUrl =
      viewToOpen === 'occurrences'
        ? `${window.location.pathname}?view=occurrences`
        : window.location.pathname;
    window.history.pushState({}, '', nextUrl);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand compact />
        <nav aria-label="Navegação principal">
          <button
            className={`nav-item nav-item--primary ${
              view === 'overview' ? 'nav-item--active' : ''
            }`}
            type="button"
            aria-current={view === 'overview' ? 'page' : undefined}
            onClick={() => navigate('overview')}
          >
            <span aria-hidden="true">⌂</span> Visão geral
          </button>
          <button
            className={`nav-item nav-item--primary ${
              view === 'occurrences' ? 'nav-item--active' : ''
            }`}
            type="button"
            aria-current={view === 'occurrences' ? 'page' : undefined}
            onClick={() => navigate('occurrences')}
          >
            <span aria-hidden="true">△</span> Ocorrências
          </button>
          <button className="nav-item nav-item--disabled" type="button" disabled>
            <span aria-hidden="true">⌖</span> Mapa de calor
            <small>em breve</small>
          </button>
          <span className="nav-item nav-item--disabled">
            <span aria-hidden="true">✓</span> Equipes <small>em breve</small>
          </span>
          <span className="nav-item nav-item--disabled">
            <span aria-hidden="true">↗</span> Relatórios <small>em breve</small>
          </span>
        </nav>
        <div className="sidebar__footer">
          <span className="avatar" aria-hidden="true">
            {user?.name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{user?.name}</strong>
            <small>Operação municipal</small>
          </span>
        </div>
      </aside>

      <main className="dashboard" id="visao-geral">
        {view === 'occurrences' ? (
          <OperationsPage onLogout={logout} />
        ) : (
          <>
        <header className="dashboard__header">
          <div>
            <span className="eyebrow">Centro de operações</span>
            <h1>Visão geral da cidade</h1>
            <p>Indicadores atualizados diretamente pelo back-end do Tá na Rua!.</p>
          </div>
          <div className="header-actions">
            <span className="live-indicator">
              <i aria-hidden="true" /> Dados em tempo real
            </span>
            <button className="secondary-button" type="button" onClick={() => void loadDashboard()}>
              Atualizar
            </button>
            <button className="text-button" type="button" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </header>

        {error && (
          <div className="dashboard-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadDashboard()}>
              Tentar novamente
            </button>
          </div>
        )}

        <section className="metric-grid" aria-label="Indicadores principais" aria-busy={loading}>
          <MetricCard
            label="Total de ocorrências"
            value={summary ? formatNumber(summary.totalOccurrences) : '—'}
            detail="Registros no município"
            tone="blue"
          />
          <MetricCard
            label="Em atendimento"
            value={summary ? formatNumber(summary.activeOccurrences) : '—'}
            detail="Demandas ativas"
            tone="orange"
          />
          <MetricCard
            label="Resolvidas"
            value={summary ? formatNumber(summary.resolvedOccurrences) : '—'}
            detail="Soluções registradas"
            tone="green"
          />
          <MetricCard
            label="Taxa de resolução"
            value={summary ? `${summary.resolutionRate.toFixed(1)}%` : '—'}
            detail={summary ? `${formatNumber(summary.totalConfirmations)} confirmações` : 'Participação cidadã'}
            tone="red"
          />
        </section>

        <section className="dashboard-grid">
          <article className="panel priority-panel" id="prioridades">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Fila inteligente</span>
                <h2>Ocorrências prioritárias</h2>
              </div>
              <span className="panel__count">{ranking.length} em destaque</span>
            </div>
            {loading ? (
              <div className="panel-loading">Organizando prioridades…</div>
            ) : ranking.length === 0 ? (
              <div className="empty-state">Nenhuma ocorrência para os filtros atuais.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Ocorrência</th>
                      <th>Bairro</th>
                      <th>Status</th>
                      <th>Prioridade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((occurrence, index) => (
                      <tr key={occurrence.occurrenceId}>
                        <td>
                          <span className="rank-number">{index + 1}</span>
                          <span>
                            <strong>{occurrence.title}</strong>
                            <small>
                              {occurrence.protocol} · {occurrence.categoryName ?? 'Sem categoria'}
                            </small>
                          </span>
                        </td>
                        <td>{occurrence.neighborhoodName ?? 'Não informado'}</td>
                        <td>
                          <span className={`status status--${occurrence.status.toLowerCase()}`}>
                            {statusLabels[occurrence.status] ?? occurrence.status}
                          </span>
                        </td>
                        <td>
                          <strong className="priority-score">
                            {occurrence.priorityScore.toFixed(1)}
                          </strong>
                          <small>{occurrence.confirmationCount} confirmações</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="panel category-panel" id="categorias">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Distribuição</span>
                <h2>Por categoria</h2>
              </div>
            </div>
            <div className="category-list">
              {categories.slice(0, 5).map((category, index) => (
                <div className="category-row" key={category.key ?? category.name}>
                  <span className={`category-dot category-dot--${(index % 5) + 1}`} />
                  <span>
                    <strong>{category.name}</strong>
                    <small>{category.percentage.toFixed(1)}% do total</small>
                  </span>
                  <strong>{formatNumber(category.count)}</strong>
                  <span className="category-bar">
                    <i style={{ width: `${Math.min(category.percentage, 100)}%` }} />
                  </span>
                </div>
              ))}
              {!loading && categories.length === 0 && (
                <div className="empty-state">Ainda não há categorias contabilizadas.</div>
              )}
            </div>
          </article>
        </section>
          </>
        )}
      </main>
    </div>
  );
}

export function App() {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'anonymous') return <LoginPage />;
  return <DashboardPage />;
}
