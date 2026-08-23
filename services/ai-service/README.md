# Serviço de análise assistida — AI-0

Este pacote implementa o serviço HTTP externo consumido pelo back-end do Tá na
Rua. A AI-0 valida o contrato de integração, sugere categoria e gravidade e
compara ocorrências próximas.

## Limite desta fase

O mecanismo atual é determinístico e exclusivo de desenvolvimento. Ele não usa
um modelo treinado, não avalia o conteúdo real da imagem e não está autorizado a
tomar decisões automáticas:

- `requiresHumanReview` é sempre `true`;
- a confiança nunca ultrapassa `0.70`;
- categorias são escolhidas somente entre as fornecidas pelo back-end;
- duplicidades são sugeridas somente entre as ocorrências próximas fornecidas;
- o modo `DETERMINISTIC` se recusa a iniciar com `NODE_ENV=production`.

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
