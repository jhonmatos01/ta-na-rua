# AI-1 — Integração com OmniRoute local

Data de referência: 22 de agosto de 2026.

## Resultado

A AI-1 adiciona ao serviço isolado uma implementação `OPENAI_COMPATIBLE` para o
servidor local OmniRoute disponível em `http://localhost:20128/v1`, usando o
modelo `Meu primeiro combo`.

O back-end continua consumindo o contrato interno `POST /analyze`; somente o
serviço AI conhece o formato OpenAI-compatible. Isso mantém a API pública e o
cliente do back-end estáveis.

## Proteções

- a chave do provedor é lida apenas de `AI_PROVIDER_API_KEY` no ambiente;
- a chave nunca é registrada, persistida no banco, incluída na resposta ou
  versionada;
- o cabeçalho `Authorization: Bearer` só é enviado quando a variável existe;
- o servidor local respondeu ao teste sintético sem exigir essa variável;
- o modo determinístico continua disponível para testes sem dependência externa;
- o modo determinístico continua bloqueado em produção;
- o provedor pode responder SSE ou JSON;
- o conteúdo é limitado a 256 KiB antes da validação;
- categorias precisam existir em `availableCategories`;
- IDs de duplicidade precisam existir em `nearbyOccurrences`;
- `requiresHumanReview` permanece verdadeiro;
- falhas do provedor viram erro controlado e não alteram a ocorrência.

## Configuração local

No `.env` ignorado do serviço:

```text
AI_SERVICE_MODE=OPENAI_COMPATIBLE
AI_PROVIDER_BASE_URL=http://localhost:20128/v1
AI_PROVIDER_MODEL=Meu primeiro combo
AI_PROVIDER_API_KEY=
AI_PROVIDER_FORCE_HUMAN_REVIEW=true
```

Se o OmniRoute exigir autenticação, preencher `AI_PROVIDER_API_KEY` somente no
`.env` local. A chave compartilhada durante a conversa não foi gravada no
projeto; por segurança, ela deve ser rotacionada depois do teste.

No `.env` do back-end, usar um segredo interno independente:

```text
AI_SERVICE_URL=http://127.0.0.1:8000
AI_SERVICE_SECRET=<segredo-local-com-32-ou-mais-caracteres>
```

O segredo interno não é a chave do provedor.

## Evidências automatizadas

```text
AI service: lint aprovado
AI service: typecheck aprovado
AI service: 17 testes aprovados em 4 arquivos
AI service: build aprovado
Back-end: validação de regressão a executar após esta documentação
```

Testes específicos:

- parsing de SSE do OmniRoute;
- resposta JSON compatível;
- modelo `Meu primeiro combo` enviado no corpo;
- revisão humana forçada;
- categoria inventada rejeitada;
- erro HTTP do provedor convertido em indisponibilidade controlada;
- URL do provedor obrigatória no modo `OPENAI_COMPATIBLE`;
- HTTPS obrigatório para provedor em produção.

## Teste integrado executado

Foi iniciado o build compilado do serviço com:

```text
AI_SERVICE_MODE=OPENAI_COMPATIBLE
AI_PROVIDER_BASE_URL=http://localhost:20128/v1
AI_PROVIDER_MODEL=Meu primeiro combo
```

Com um reporte sintético e categorias `POTHOLE` e `WATER_LEAK`, o resultado foi:

```text
health=ok
mode=OPENAI_COMPATIBLE
provider=True
category=POTHOLE
severity=4
review=True
```

Nenhum dado real de cidadão foi enviado nesse teste.
