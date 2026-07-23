import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '../components/button';
import { FormField } from '../components/form-field';
import { PwaInstallCard } from '../components/pwa-install-card';
import { env } from '../config/env';
import { useAuth } from '../features/auth/auth-context';
import { getAuthErrorMessage } from '../features/auth/auth-errors';
import {
  getFieldErrors,
  profileFormSchema,
  type FieldErrors,
} from '../features/auth/auth-form-schemas';

export function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const user = auth.user;

  if (user === null) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    const parsed = profileFormSchema.safeParse({
      name: form.get('name'),
      phone: form.get('phone'),
      neighborhood: form.get('neighborhood'),
      avatarUrl: form.get('avatarUrl'),
    });

    if (!parsed.success) {
      setErrors(getFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await auth.updateProfile({
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        neighborhood: parsed.data.neighborhood ?? null,
        avatarUrl: parsed.data.avatarUrl ?? null,
      });
      setSuccess('Perfil atualizado com sucesso.');
    } catch (error) {
      setRequestError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const initials = user.name
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const safeAvatarUrl = user.avatarUrl?.startsWith('https://') ? user.avatarUrl : null;

  return (
    <section className="bg-canvas py-10 sm:py-16">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <aside className="h-fit rounded-3xl bg-ink p-6 text-white shadow-floating sm:p-8">
          {safeAvatarUrl ? (
            <img
              src={safeAvatarUrl}
              alt={`Foto de ${user.name}`}
              className="size-16 rounded-2xl object-cover shadow-brand"
            />
          ) : (
            <span
              className="grid size-16 place-items-center rounded-2xl bg-brand-600 text-xl font-black shadow-brand"
              aria-hidden="true"
            >
              {initials}
            </span>
          )}
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-200">
            Conta cidadã
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{user.name}</h1>
          <p className="mt-2 break-all text-sm text-slate-300">{user.email}</p>
          <dl className="mt-8 space-y-4 border-t border-white/10 pt-6 text-sm">
            <div>
              <dt className="text-slate-400">Município</dt>
              <dd className="mt-1 font-bold">{env.defaultMunicipalityName}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Situação</dt>
              <dd className="mt-1 inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 font-bold text-emerald-300">
                Conta ativa
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Membro desde</dt>
              <dd className="mt-1 font-bold">
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
                  new Date(user.createdAt),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Último acesso</dt>
              <dd className="mt-1 font-bold">
                {user.lastLoginAt
                  ? new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(user.lastLoginAt))
                  : 'Primeiro acesso'}
              </dd>
            </div>
          </dl>
          <nav
            className="mt-7 grid gap-2 border-t border-white/10 pt-6"
            aria-label="Atalhos da conta"
          >
            <Link
              to="/minhas-ocorrencias"
              className="rounded-xl bg-white/10 px-4 py-3 text-sm font-extrabold transition hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-200"
            >
              Minhas ocorrências
            </Link>
            <Link
              to="/notificacoes"
              className="rounded-xl bg-white/10 px-4 py-3 text-sm font-extrabold transition hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-200"
            >
              Notificações
            </Link>
            <button
              type="button"
              onClick={() => void auth.logout().then(() => navigate('/'))}
              className="min-h-11 rounded-xl px-4 text-left text-sm font-extrabold text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-200 md:hidden"
            >
              Encerrar sessão
            </button>
          </nav>
        </aside>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
            Meu perfil
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
            Seus dados essenciais
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            Mantenha as informações usadas na sua participação atualizadas.
          </p>

          {requestError ? (
            <div
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
              role="alert"
            >
              {requestError}
            </div>
          ) : null}
          {success ? (
            <div
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"
              role="status"
            >
              {success}
            </div>
          ) : null}

          <form
            key={user.updatedAt}
            className="mt-8 space-y-5"
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
          >
            <FormField
              id="profile-name"
              name="name"
              label="Nome"
              autoComplete="name"
              defaultValue={user.name}
              required
              error={errors.name}
            />
            <FormField
              id="profile-email"
              label="E-mail"
              type="email"
              value={user.email}
              readOnly
              aria-readonly="true"
              hint="O e-mail identifica sua conta e não pode ser alterado nesta fase."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="profile-phone"
                name="phone"
                label="Telefone"
                type="tel"
                autoComplete="tel"
                defaultValue={user.phone ?? ''}
                error={errors.phone}
              />
              <FormField
                id="profile-neighborhood"
                name="neighborhood"
                label="Bairro"
                autoComplete="address-level3"
                defaultValue={user.neighborhood ?? ''}
                error={errors.neighborhood}
              />
            </div>
            <FormField
              id="profile-avatar"
              name="avatarUrl"
              label="URL da foto de perfil"
              type="url"
              autoComplete="url"
              defaultValue={user.avatarUrl ?? ''}
              error={errors.avatarUrl}
              hint="Opcional. Use uma imagem pública em HTTPS; nenhum arquivo é enviado pelo navegador."
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
          <PwaInstallCard />
        </div>
      </div>
    </section>
  );
}
