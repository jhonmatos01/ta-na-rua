# AI-0 — Fundação segura do serviço de análise

Data de referência: 24 de julho de 2026.

## Resultado

A AI-0 implementa, em `services/ai-service`, o serviço HTTP externo esperado pelo
back-end. A fase cria uma integração executável e testável sem escolher
silenciosamente um fornecedor pago e sem conceder poder decisório a uma
heurística de desenvolvimento.

Não há alteração de migration, banco de dados, autenticação de usuários,
autorização municipal, estados de ocorrência nem contrato público da API.

## Escopo implementado

- `GET /health`;
- `POST /analyze`;
- validação estrita do contrato 1.0 descrito em `CONTRATO_IA.md`;
- autenticação entre serviços por `x-ai-service-secret`;
- comparação constante do segredo por hash;
- `x-idempotency-key` obrigatório e igual ao `reportId`;
- limite de 256 KiB para o corpo;
- sugestão determinística de categoria, gravidade e risco;
- comparação determinística com ocorrências próximas;
- respostas reproduzíveis para novas tentativas;
- erros genéricos que não devolvem descrição, coordenadas, imagem ou segredo;
- inicialização recusada em produção enquanto o modo for `DETERMINISTIC`.

## Proteções funcionais

O mecanismo da AI-0 é uma ponte de integração, não um modelo de produção:

- `requiresHumanReview` é sempre `true`;
- confiança máxima de `0.70`;
- a categoria retornada pertence obrigatoriamente a `availableCategories`;
- IDs de possíveis duplicidades pertencem obrigatoriamente a
  `nearbyOccurrences`;
- nenhuma ocorrência é fundida;
- nenhum status é alterado;
- imagens não são interpretadas nesta fase;
- o serviço não registra corpos, imagens, coordenadas ou segredos.

O back-end mantém suas próprias validações de domínio, timeout, retry, fallback e
persistência segura. Assim, uma resposta inválida continua sem afetar a
ocorrência.

## Evidências automatizadas

Validação do serviço:

```text
lint: aprovado
typecheck: aprovado
test: 12 testes aprovados em 3 arquivos
build: aprovado
auditoria npm: 0 vulnerabilidades conhecidas
```

Validação de regressão do projeto principal:

```text
lint: aprovado
test: 210 testes aprovados em 40 arquivos
build: aprovado
```

Os testes da AI-0 cobrem:

- saúde e identificação explícita do modo não produtivo;
- segredo ausente ou incorreto;
- segredo local fraco;
- bloqueio do mecanismo determinístico em produção;
- chave de idempotência ausente ou divergente;
- corpo com campo desconhecido;
- JSON malformado;
- compatibilidade do schema de resposta;
- escolha restrita às categorias fornecidas;
- duplicidades restritas aos candidatos fornecidos;
- revisão humana obrigatória;
- resposta determinística;
- ausência de dados submetidos e segredos nos erros.

## Execução local

No diretório `services/ai-service`:

```powershell
Copy-Item .env.example .env
```

Substitua apenas o valor de exemplo de `AI_SERVICE_SECRET` por um segredo local
aleatório de pelo menos 32 caracteres. O mesmo valor deve ser configurado no
back-end, junto com:

```text
AI_SERVICE_URL=http://127.0.0.1:8000
```

Depois execute:

```powershell
npm install
npm run dev
```

O procedimento completo está no `README.md` do serviço. Nenhum segredo real faz
parte do repositório.

## Critérios para a AI-1

A próxima fase deve começar pela decisão explícita de:

1. fornecedor e modelo;
2. região de processamento e retenção de dados;
3. orçamento e limites de uso;
4. política para envio de imagens;
5. conjunto de avaliação com categorias reais;
6. métricas mínimas de precisão e segurança;
7. estratégia de fallback e desligamento.

Somente depois dessa decisão o adaptador real deve substituir o mecanismo
determinístico em produção.
