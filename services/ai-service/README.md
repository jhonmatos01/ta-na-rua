# Serviço de análise assistida — AI-1

Este pacote implementa o serviço HTTP externo consumido pelo back-end do Tá na
Rua. A AI-1 adiciona um adaptador OpenAI-compatible para o OmniRoute local,
mantendo o contrato de integração, as sugestões e a revisão humana.

## Modos disponíveis

`DETERMINISTIC` continua disponível para testes sem dependência externa. Para
usar seu OmniRoute local, configure:

```text
AI_SERVICE_MODE=OPENAI_COMPATIBLE
AI_PROVIDER_BASE_URL=http://localhost:20128/v1
AI_PROVIDER_MODEL=Meu primeiro combo
```

O serviço aceita `AI_PROVIDER_API_KEY` quando o provedor exigir autenticação,
mas nunca registra essa chave. Não coloque uma chave real no repositório; use
somente o `.env` local, ignorado pelo Git.

Nos dois modos, a integração não toma decisões automáticas:

- `requiresHumanReview` é sempre `true`;
- categorias são escolhidas somente entre as fornecidas pelo back-end;
- duplicidades são sugeridas somente entre as ocorrências próximas fornecidas;
- o modo `DETERMINISTIC` se recusa a iniciar com `NODE_ENV=production`;
- respostas SSE ou JSON do provedor passam por validação estrita antes de sair.

Um provedor real será conectado na AI-1 depois da escolha explícita do serviço,
do modelo, do orçamento e da política de privacidade.

## Executar localmente

Copie `.env.example` para `.env` e substitua `AI_SERVICE_SECRET` por um valor
local aleatório com pelo menos 32 caracteres. Use o mesmo valor em
`AI_SERVICE_SECRET` no back-end e configure:

```text
AI_SERVICE_URL=http://127.0.0.1:8000
```

Depois:

```bash
npm install
npm run dev
```

O serviço oferece:

- `GET /health`;
- `POST /analyze`, protegido por `x-ai-service-secret`;
- `x-idempotency-key` obrigatório e igual ao `reportId`.

Nenhum corpo de requisição, imagem, coordenada ou segredo é registrado pelo
serviço.

## Validação

```bash
npm run validate
```

Esse comando executa lint, verificação de tipos, testes e build.
