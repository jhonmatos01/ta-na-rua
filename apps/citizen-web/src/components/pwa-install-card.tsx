import { useState } from 'react';

import { usePwaInstall } from '../features/pwa/use-pwa-install';
import { Button } from './button';

export function PwaInstallCard() {
  const { canInstall, install, installed } = usePwaInstall();
  const [installing, setInstalling] = useState(false);

  async function handleInstall() {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <section className="mt-9 border-t border-slate-200 pt-8" aria-labelledby="install-app-title">
      <div className="flex items-start gap-4">
        <img src="/icons/app-icon-192.png" alt="" className="size-14 rounded-2xl shadow-card" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-700">
            Aplicativo instalável
          </p>
          <h2 id="install-app-title" className="mt-2 text-2xl font-black text-ink">
            Leve o Tá na Rua! para a tela inicial
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Abra mais rápido, use em modo independente e tenha uma tela segura quando estiver sem
            conexão.
          </p>
        </div>
      </div>
      {installed ? (
        <p
          className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900"
          role="status"
        >
          Aplicativo instalado neste dispositivo.
        </p>
      ) : canInstall ? (
        <Button className="mt-5" disabled={installing} onClick={() => void handleInstall()}>
          {installing ? 'Abrindo instalação...' : 'Instalar aplicativo'}
        </Button>
      ) : (
        <p className="mt-5 rounded-2xl bg-canvas p-4 text-sm leading-6 text-slate-600">
          No celular, abra o menu do navegador e escolha <strong>Adicionar à tela inicial</strong>.
          No computador, procure o ícone de instalação na barra de endereço.
        </p>
      )}
    </section>
  );
}
