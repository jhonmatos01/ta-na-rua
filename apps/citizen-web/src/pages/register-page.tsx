import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthPageShell } from '../components/auth-page-shell';
import { Button } from '../components/button';
import { FormField } from '../components/form-field';
import { env } from '../config/env';
import { useAuth } from '../features/auth/auth-context';
import { getAuthErrorMessage } from '../features/auth/auth-errors';
import {
  getFieldErrors,
  registerFormSchema,
  type FieldErrors,
} from '../features/auth/auth-form-schemas';

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.status === 'authenticated') return <Navigate to="/perfil" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    const form = new FormData(event.currentTarget);
    const parsed = registerFormSchema.safeParse({
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone'),
      neighborhood: form.get('neighborhood'),
      password: form.get('password'),
      passwordConfirmation: form.get('passwordConfirmation'),
    });

    if (!parsed.success) {
      setErrors(getFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await auth.register({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        municipalityId: env.defaultMunicipalityId,
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.neighborhood ? { neighborhood: parsed.data.neighborhood } : {}),
      });
      await navigate('/entrar', {
        replace: true,
        state: { registeredEmail: parsed.data.email },
      });
    } catch (error) {
      setRequestError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      eyebrow="Nova conta"
      title="Sua cidade começa com você."
      description="Crie sua conta cidadã. Os dados solicitados aqui são somente os necessários para identificar sua participação."
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
              <path d="M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </span>
          <h2 className="mt-8 text-3xl font-black tracking-tight">
            Uma conta ligada à sua comunidade.
          </h2>
          <p className="mt-5 leading-7 text-brand-50">
            Esta implantação atende <strong>{env.defaultMunicipalityName}</strong>. O município é
            definido de forma segura pela configuração pública do aplicativo.
          </p>
        </>
      }
    >
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
          id="name"
          name="name"
          label="Nome completo"
          autoComplete="name"
          required
          error={errors.name}
        />
        <FormField
          id="email"
          name="email"
          type="email"
          label="E-mail"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          required
          error={errors.email}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="phone"
            name="phone"
            type="tel"
            label="Telefone"
            autoComplete="tel"
            inputMode="tel"
            placeholder="(71) 99999-0000"
            error={errors.phone}
          />
          <FormField
            id="neighborhood"
            name="neighborhood"
            label="Bairro"
            autoComplete="address-level3"
            placeholder="Ex.: Pituba"
            error={errors.neighborhood}
          />
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-700">
            Município da conta
          </p>
          <p className="mt-1 font-black text-ink">{env.defaultMunicipalityName}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="password"
            name="password"
            type="password"
            label="Senha"
            autoComplete="new-password"
            required
            error={errors.password}
            hint={`Use pelo menos ${env.passwordMinLength} caracteres.`}
          />
          <FormField
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            label="Confirmar senha"
            autoComplete="new-password"
            required
            error={errors.passwordConfirmation}
          />
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Ao criar a conta, você concorda em usar o aplicativo de forma responsável. Nunca inclua
          dados pessoais de terceiros em relatos públicos.
        </p>
        <Button className="w-full" type="submit" disabled={submitting || auth.status === 'loading'}>
          {submitting ? 'Criando conta...' : 'Criar minha conta'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Já possui uma conta?{' '}
        <Link className="font-extrabold text-brand-700 hover:text-brand-800" to="/entrar">
          Entrar
        </Link>
      </p>
    </AuthPageShell>
  );
}
