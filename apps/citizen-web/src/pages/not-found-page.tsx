import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="mx-auto grid w-full max-w-4xl place-items-center px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="max-w-xl">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-700">Erro 404</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
          Página não encontrada
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          O endereço acessado não existe ou foi movido.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-brand-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}
