import type { PropsWithChildren, ReactNode } from 'react';

interface AuthPageShellProps extends PropsWithChildren {
  eyebrow: string;
  title: string;
  description: string;
  aside: ReactNode;
}

export function AuthPageShell({
  eyebrow,
  title,
  description,
  aside,
  children,
}: AuthPageShellProps) {
  return (
    <section className="relative overflow-hidden bg-canvas py-10 sm:py-16">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent" />
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden px-4 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-floating sm:p-10 lg:rounded-r-none lg:border-r-0 lg:p-12">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl leading-7 text-slate-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
        <aside className="relative hidden overflow-hidden rounded-r-3xl bg-brand-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-16 -top-16 size-56 rounded-full bg-brand-500/40 blur-2xl" />
          <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-brand-950/50 blur-2xl" />
          <div className="relative">{aside}</div>
          <p className="relative mt-10 text-sm leading-6 text-brand-100">
            Seus dados de acesso são transmitidos somente para a API oficial. O token de renovação
            permanece protegido em cookie <span className="font-bold text-white">httpOnly</span>.
          </p>
        </aside>
      </div>
    </section>
  );
}
