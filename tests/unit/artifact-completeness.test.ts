import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function filesBelow(relativeDirectory: string): string[] {
  const directory = path.join(root, relativeDirectory);
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    const relative = path.relative(root, absolute);
    return statSync(absolute).isDirectory() ? filesBelow(relative) : [relative];
  });
}

describe('artefatos finais', () => {
  it('entrega todos os documentos complementares obrigatorios', () => {
    const required = [
      'README.md',
      '.env.example',
      '.env.production.example',
      'docker-compose.yml',
      'docker-compose.production.yml',
      'Dockerfile',
      'docs/ERD.md',
      'docs/CONTRATO_IA.md',
      'docs/CONTRATO_PAINEL.md',
      'docs/CONTRATO_N8N.md',
      'docs/RELATORIO_SEGURANCA.md',
      'docs/LIMITACOES.md',
      'docs/DEPLOY.md',
      'docs/FASE10_VALIDACAO.md',
    ];

    for (const file of required) {
      expect(read(file).trim().length, `${file} esta vazio`).toBeGreaterThan(100);
    }
  });

  it('nao versiona tokens, chaves privadas ou credenciais de provedores', () => {
    const candidates = [
      'README.md',
      '.env.example',
      '.env.production.example',
      ...filesBelow('docs').filter((file) => file.endsWith('.md')),
      ...filesBelow('api-client').filter((file) => file.endsWith('.bru')),
    ];
    const forbidden = [
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/u,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
      /\bAKIA[A-Z0-9]{16}\b/u,
      /\bghp_[A-Za-z0-9]{30,}\b/u,
      /\bsk-[A-Za-z0-9]{32,}\b/u,
    ];

    for (const file of candidates) {
      const content = read(file);
      for (const pattern of forbidden) {
        expect(pattern.test(content), `${file} corresponde a ${String(pattern)}`).toBe(false);
      }
    }
  });

  it('mantem tokens vazios e apenas placeholders no ambiente Bruno', () => {
    const environment = read('api-client/environments/local.bru');
    for (const variable of [
      'accessToken',
      'citizenAccessToken',
      'operatorAccessToken',
      'moderatorAccessToken',
      'adminAccessToken',
    ]) {
      expect(environment).toMatch(new RegExp(`\\s${variable}:\\s*(?:\\r?\\n)`));
    }
    for (const variable of [
      'aiServiceSecret',
      'telegramWebhookSecret',
      'whatsappWebhookSecret',
      'n8nWebhookSecret',
    ]) {
      expect(environment).toMatch(new RegExp(`\\s${variable}: replace-with-`));
    }
  });

  it('endurece a imagem e nao publica banco ou Adminer no compose de producao', () => {
    const dockerfile = read('Dockerfile');
    const compose = read('docker-compose.production.yml');
    const postgresBlock = compose.slice(
      compose.indexOf('  postgres:'),
      compose.indexOf('  migrate:'),
    );

    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(compose).toContain('read_only: true');
    expect(compose).toContain('cap_drop: [ALL]');
    expect(compose).not.toContain('adminer:');
    expect(postgresBlock).not.toContain('ports:');
  });
});
