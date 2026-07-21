import { Link } from 'react-router-dom';

export function UnavailablePage() {
  return (
    <section className="mx-auto grid w-full max-w-4xl place-items-center px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="max-w-xl">
        <p className="text-sm font-bold uppercase tracking-widest text-amber-700">
          Serviço indisponível
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
          Estamos preparando o caminho
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          Esta área ainda não está disponível ou passa por uma manutenção breve. Você pode conferir
          o estado geral dos serviços.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            className="font-extrabold text-brand-800 underline decoration-2 underline-offset-4"
            to="/status"
          >
            Ver status
          </Link>
          <Link
            className="font-extrabold text-slate-700 underline decoration-2 underline-offset-4"
            to="/"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </section>
  );
}
