export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // A aplicação continua funcionando online quando o navegador bloqueia o service worker.
    });
  });
}
