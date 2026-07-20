import { describe, expect, it, vi } from 'vitest';

import {
  createGracefulShutdown,
  type HttpServerPort,
} from '../../src/shared/server/graceful-shutdown.js';

describe('createGracefulShutdown', () => {
  it('encerra o servidor e o pool apenas uma vez', async () => {
    const close = vi.fn<HttpServerPort['close']>((callback) => callback());
    const closeAllConnections = vi.fn<HttpServerPort['closeAllConnections']>();
    const closeDatabase = vi.fn<() => Promise<void>>().mockResolvedValue();
    const info = vi.fn();
    const error = vi.fn();
    const setExitCode = vi.fn();
    const shutdown = createGracefulShutdown({
      server: { close, closeAllConnections },
      closeDatabase,
      logger: { info, error },
      setExitCode,
    });

    await shutdown('SIGTERM');
    await shutdown('SIGINT');

    expect(close).toHaveBeenCalledOnce();
    expect(closeDatabase).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
    expect(setExitCode).not.toHaveBeenCalled();
    expect(closeAllConnections).not.toHaveBeenCalled();
  });
});
