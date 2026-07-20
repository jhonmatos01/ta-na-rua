import type { Logger } from 'pino';

export interface HttpServerPort {
  close(callback: (error?: Error) => void): void;
  closeAllConnections(): void;
}

export interface GracefulShutdownOptions {
  server: HttpServerPort;
  closeDatabase: () => Promise<void>;
  logger: Pick<Logger, 'info' | 'error'>;
  timeoutMs?: number;
  setExitCode?: (code: number) => void;
}

export type ShutdownHandler = (signal: NodeJS.Signals) => Promise<void>;

function closeHttpServer(server: HttpServerPort): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

export function createGracefulShutdown(options: GracefulShutdownOptions): ShutdownHandler {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const setExitCode = options.setExitCode ?? ((code: number) => (process.exitCode = code));
  let shuttingDown = false;

  return async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    options.logger.info({ signal }, 'Desligamento gracioso iniciado.');

    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        options.server.closeAllConnections();
        reject(new Error('Tempo limite excedido durante o desligamento gracioso.'));
      }, timeoutMs);
      timeout.unref();
    });

    try {
      await Promise.race([closeHttpServer(options.server), timeoutPromise]);
      await options.closeDatabase();
      options.logger.info('Servidor HTTP e conexoes com o banco encerrados.');
    } catch (error) {
      options.logger.error({ err: error }, 'Falha durante o desligamento gracioso.');
      setExitCode(1);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  };
}
