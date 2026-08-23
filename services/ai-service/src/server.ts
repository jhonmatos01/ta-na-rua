import 'dotenv/config';

import { createApp } from './app.js';
import { parseAiServiceConfig } from './config.js';

const config = parseAiServiceConfig();
const app = createApp(config);
const server = app.listen(config.port, config.host, () => {
  process.stdout.write(
    `AI service listening on http://${config.host}:${String(config.port)} in ${config.mode} mode.\n`,
  );
});

function shutdown(): void {
  server.close((error) => {
    if (error !== undefined) {
      process.stderr.write('AI service could not stop cleanly.\n');
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
