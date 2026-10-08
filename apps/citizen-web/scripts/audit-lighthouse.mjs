import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import lighthouse from 'lighthouse';
import { preview } from 'vite';

const commonThresholds = {
  accessibility: 0.9,
  'best-practices': 0.9,
  seo: 0.8,
};

const auditedPages = [
  { path: '/', thresholds: { performance: 0.8, ...commonThresholds } },
  {
    path: '/mapa',
    thresholds: { performance: 0.6, ...commonThresholds },
  },
];
const temporaryRoot = join(process.cwd(), 'tmp');
await mkdir(temporaryRoot, { recursive: true });
process.env.TEMP = temporaryRoot;
process.env.TMP = temporaryRoot;
const chromeProfile = await mkdtemp(join(temporaryRoot, 'lighthouse-'));
const previewServer = await preview({
  logLevel: 'error',
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  userDataDir: chromeProfile,
});

let hasFailure = false;

try {
  for (const { path, thresholds } of auditedPages) {
    const result = await lighthouse(`http://127.0.0.1:4173${path}`, {
      logLevel: 'error',
      output: 'json',
      onlyCategories: Object.keys(thresholds),
      maxWaitForLoad: 25_000,
      port: chrome.port,
    });

    if (!result) {
      throw new Error(`Lighthouse não retornou resultado para ${path}.`);
    }

    const scores = Object.fromEntries(
      Object.entries(thresholds).map(([category, threshold]) => {
        const score = result.lhr.categories[category]?.score ?? 0;
        if (score < threshold) {
          hasFailure = true;
        }
        return [category, `${Math.round(score * 100)} (mínimo ${Math.round(threshold * 100)})`];
      }),
    );

    console.log(`Lighthouse ${path}: ${JSON.stringify(scores)}`);

    if ((result.lhr.categories.performance.score ?? 0) < thresholds.performance) {
      const metricIds = [
        'first-contentful-paint',
        'largest-contentful-paint',
        'speed-index',
        'total-blocking-time',
        'cumulative-layout-shift',
      ];
      const metrics = Object.fromEntries(
        metricIds.map((auditId) => {
          const audit = result.lhr.audits[auditId];
          return [auditId, audit?.displayValue ?? audit?.numericValue ?? 'indisponível'];
        }),
      );
      console.log(`Métricas ${path}: ${JSON.stringify(metrics)}`);
    }
  }
} finally {
  try {
    process.kill(chrome.pid, 'SIGKILL');
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') {
      console.warn('Não foi possível encerrar o Chromium temporário do Lighthouse.', error);
    }
  } finally {
    await previewServer.close();
  }
}

if (hasFailure) {
  throw new Error('Uma ou mais categorias do Lighthouse ficaram abaixo do limite da FE-7.');
}
