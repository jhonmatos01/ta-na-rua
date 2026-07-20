# Validacao da Fase 3

Data da validacao tecnica: 19 de julho de 2026.

Estado: implementacao tecnicamente concluida; aguardando aprovacao explicita do usuario.

## Escopo validado

- criacao autenticada com imagem inicial obrigatoria;
- protocolo `TNR-AAAA-NNNNNN` atomico e sem reutilizacao;
- `PENDING_REVIEW`, primeiro relato, historico, auditoria e notificacao;
- upload JPEG/PNG/WebP, MIME real, tamanho, quantidade, chave aleatoria e limpeza de orfaos;
- armazenamento local e contrato S3 compativel;
- listagem, filtros, paginacao, detalhes, ocorrencias proprias, atualizacao e exclusao logica;
- `nearby` com `ST_DWithin` e pontos resumidos para mapa;
- privacidade publica e isolamento municipal;
- Swagger 0.4.0, colecao Bruno e exemplo de upload.

## Validacao automatizada

Execute:

```bash
npm run lint
npm test
npm run test:coverage
npm run build
npm run db:validate
npm run format:check
npm audit --omit=dev
npm run validate
```

Resultado registrado nesta fase:

- 12 arquivos e 55 testes aprovados;
- statements: 84,37%;
- branches: 77,04%;
- functions: 88,27%;
- lines: 85,04%;
- zero vulnerabilidades em dependencias de producao.

Os repositorios PostgreSQL nao entram na metrica unitaria, assim como o repositorio de identidade. Eles foram exercitados contra o PostgreSQL/PostGIS real pelos cenarios abaixo.

## Evidencia no PostgreSQL/PostGIS real

A criacao HTTP retornou `TNR-2026-000004`, `PENDING_REVIEW` e uma imagem inicial. Depois da imagem adicional, a consulta direta confirmou:

| Evidencia    | Resultado  |
| ------------ | ---------- |
| Geometria    | `ST_Point` |
| SRID         | 4326       |
| Relatos      | 1          |
| Imagens      | 2          |
| Historicos   | 1          |
| Auditorias   | 2          |
| Notificacoes | 1          |

Quatro criacoes concorrentes retornaram protocolos distintos (`000005` a `000008`, fora de ordem de conclusao), confirmando a serializacao atomica do contador anual.

Uma criacao final no mesmo ponto do registro `TNR-2026-000001` retornou esse protocolo como um candidato publico de proximidade dentro de 30 m. O novo protocolo foi `TNR-2026-000010` e tambem foi removido apos a conferencia.

Os registros temporarios e seus quatro objetos locais foram removidos depois da validacao. O contador nao foi reduzido: protocolos ja emitidos nunca sao reutilizados, conforme o PRD.

## Teste pelo Swagger

1. Acesse http://localhost:3333/docs.
2. Abra `POST /api/v1/auth/login`, use o usuario cidadao local e copie o `accessToken`.
3. Clique em **Authorize** e informe somente o JWT.
4. Abra `POST /api/v1/occurrences` e clique em **Try it out**.
5. Preencha:
   - `title`: `Validacao via Swagger Fase 3`;
   - `municipalityId`: `10000000-0000-4000-8000-000000000001`;
   - `categoryId`: `30000000-0000-4000-8000-000000000001`;
   - `neighborhoodId`: `20000000-0000-4000-8000-000000000001`;
   - `latitude`: `-12.9777`;
   - `longitude`: `-38.5016`;
   - `image`: `api-client/fixtures/occurrence-example.png`.
6. Execute e confirme HTTP 201, protocolo no formato esperado, `PENDING_REVIEW`, uma imagem `INITIAL` e localizacao exata para o autor.

Na validacao visual registrada, o Swagger criou `TNR-2026-000009` com HTTP 201.

## Conferencia no Adminer

Acesse http://localhost:8080, conecte ao PostgreSQL usando as variaveis locais e execute, substituindo o UUID:

```sql
SELECT
  o.protocol,
  o.status,
  ST_AsText(o.location::geometry) AS location,
  (SELECT COUNT(*) FROM occurrence_reports r WHERE r.occurrence_id = o.id) AS reports,
  (SELECT COUNT(*) FROM occurrence_images i WHERE i.occurrence_id = o.id) AS images,
  (SELECT COUNT(*) FROM occurrence_status_history h WHERE h.occurrence_id = o.id) AS history,
  (SELECT COUNT(*) FROM audit_logs a
    WHERE a.entity_type = 'occurrence' AND a.entity_id = o.id) AS audits
FROM occurrences o
WHERE o.id = '<UUID_DA_OCORRENCIA>';
```

A conferencia visual do registro criado pelo Swagger mostrou `POINT(-38.5016 -12.9777)`, um relato, uma imagem, um historico e uma auditoria.

## Privacidade e autorizacao

Foram confirmados:

- ocorrencia pendente retorna 404 ao publico e detalhe exato ao autor;
- resposta publica nao contem `createdBy` nem precisao do GPS;
- coordenadas publicas sao arredondadas para quatro casas;
- numero e complemento sao removidos do endereco publico;
- operador municipal nao consulta outro municipio;
- moderador e administrador possuem alcance global;
- somente moderador ou administrador executam exclusao logica;
- motivo interno do historico nao aparece na linha do tempo publica.

## Casos de erro cobertos

| Cenario                   | HTTP/codigo                         |
| ------------------------- | ----------------------------------- |
| Sem autenticacao          | 401 `AUTHENTICATION_REQUIRED`       |
| Imagem ausente            | 422 `IMAGE_REQUIRED`                |
| Imagem maior que o limite | 413 `IMAGE_TOO_LARGE`               |
| Assinatura invalida       | 415 `UNSUPPORTED_IMAGE_TYPE`        |
| MIME divergente           | 415 `IMAGE_MIME_MISMATCH`           |
| Coordenada invalida       | 422 `VALIDATION_ERROR`              |
| Municipio incompatível    | 422 `LOCATION_OUTSIDE_MUNICIPALITY` |
| UUID inexistente          | 404 `OCCURRENCE_NOT_FOUND`          |
| Paginacao acima do maximo | 422 `VALIDATION_ERROR`              |
| Outro municipio           | 403 `MUNICIPALITY_FORBIDDEN`        |
| Limite de imagens         | 409 `IMAGE_LIMIT_REACHED`           |

## Observacao de escopo

A classificacao por IA e a deteccao semantica de duplicidade permanecem na Fase 7. A mudanca de status operacional permanece na Fase 5. Nesta fase, a criacao consulta candidatos dentro do raio e periodo configurados, `nearby` oferece a consulta publica por distancia e toda ocorrencia nova nasce em `PENDING_REVIEW`.

O modelo atual do PRD armazena o centro do municipio, mas nao um poligono de limites. Por isso, a compatibilidade geografica da Fase 3 exige municipio ativo, centro ativo mais proximo e distancia maxima configuravel (100 km por padrao). Quando limites oficiais forem incorporados, essa regra pode ser substituida por contencao em poligono sem alterar o contrato HTTP.
