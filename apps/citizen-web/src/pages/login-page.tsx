import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { AuthPageShell } from '../components/auth-page-shell';
import { Button } from '../components/button';
import { FormField } from '../components/form-field';
import { useAuth } from '../features/auth/auth-context';
import { getAuthErrorMessage } from '../features/auth/auth-errors';
import {
  getFieldErrors,
  loginFormSchema,
  type FieldErrors,
} from '../features/auth/auth-form-schemas';

interface LoginLocationState {
  from?: string;
  registeredEmail?: string;
}

function safeDestination(requestedPath: string | undefined): string {
  return requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : '/perfil';
}

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const destination = safeDestination(state?.from);

  if (auth.status === 'authenticated') return <Navigate to={destination} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    const form = new FormData(event.currentTarget);
    const parsed = loginFormSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });

    if (!parsed.success) {
      setErrors(getFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await auth.login(parsed.data);
      await navigate(destination, { replace: true });
    } catch (error) {
      setRequestError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      eyebrow="Conta cidadã"
      title="Que bom ter você por aqui."
      description="Entre para acompanhar suas atividades e, nas próximas fases, participar diretamente do cuidado com a cidade."
      aside={
        <>
          <span className="grid size-14 place-items-center rounded-2xl bg-white/15">
            <svg
              viewBox="0 0 24 24"
              className="size-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M4 20c0-4.2 3-6.5 8-6.5s8 2.3 8 6.5" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <h2 className="mt-8 text-3xl font-black tracking-tight">
            Sua participação, com segurança.
          </h2>
          <ul className="mt-7 space-y-4 text-sm leading-6 text-brand-50">
            <li className="flex gap-3">
              <span aria-hidden="true">✓</span>
              <span>Sessão recuperada com cookie protegido.</span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true">✓</span>
              <span>Rotas privadas acessíveis somente após autenticação.</span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true">✓</span>
              <span>Nenhuma senha ou token persistido no navegador.</span>
            </li>
          </ul>
        </>
      }
    >
      {state?.registeredEmail ? (
        <div
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"
          role="status"
        >
          Conta criada com sucesso. Entre para continuar.
        </div>
      ) : null}
      {requestError ? (
        <div
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
          role="alert"
        >
          {requestError}
        </div>
      ) : null}

      <form className="space-y-5" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <FormField
          id="email"
          name="email"
          type="email"
          label="E-mail"
          autoComplete="email"
          defaultValue={state?.registeredEmail ?? ''}
          placeholder="voce@exemplo.com"
          required
          error={errors.email}
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Senha"
          autoComplete="current-password"
          required
          error={errors.password}
        />
        <Button className="w-full" type="submit" disabled={submitting || auth.status === 'loading'}>
          {submitting
            ? 'Entrando...'
            : auth.status === 'loading'
              ? 'Verificando sessão...'
              : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Ainda não tem conta?{' '}
        <Link className="font-extrabold text-brand-700 hover:text-brand-800" to="/criar-conta">
          Criar conta
        </Link>
      </p>
    </AuthPageShell>
  );
}
