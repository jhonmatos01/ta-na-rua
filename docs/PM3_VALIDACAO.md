# PM‑3 — Mapa de calor e análise territorial

## Estado

Implementação técnica e validação visual aprovadas pelo usuário em 24 de julho de 2026;
publicada para revisão no PR
[#12](https://github.com/jhonmatos01/ta-na-rua/pull/12), na branch
`codex/municipal-heatmap-analytics`.

## Escopo entregue

- Navegação ativa para `Mapa de calor` no painel municipal.
- Mapa viário detalhado com MapLibre, OpenFreeMap e dados do OpenStreetMap.
- Camada de calor por concentração e células agregadas de 250 metros.
- Pontos proporcionais ao volume, contagem visível e área ampliada de interação.
- Filtros combináveis por categoria, bairro, status e período.
- Filtros persistidos na URL para atualização e compartilhamento do recorte.
- Indicadores de ocorrências, pico por célula, prioridade média e bairro líder.
- Rankings por bairro e categoria e distribuição por status.
- Consolidação visual de bairros com o mesmo nome oriundos de cadastro e texto livre.
- Estados de carregamento, erro, vazio e indisponibilidade do mapa-base.
- Layout responsivo e navegação mobile com a terceira área principal.

## Contratos reutilizados

Nenhum contrato existente foi alterado e nenhuma migration foi necessária. A página consome:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/heatmap`
- `GET /api/v1/dashboard/by-neighborhood`
- `GET /api/v1/dashboard/by-category`
- `GET /api/v1/dashboard/by-status`

O back-end continua aplicando o escopo do município a partir do usuário autenticado.

## Privacidade

O mapa usa somente as células agregadas devolvidas pelo dashboard. Não exibe autor, endereço
residencial, complemento ou outro dado pessoal. A interface informa explicitamente que nenhum
morador é identificado.

## Desempenho

O MapLibre é carregado sob demanda. O pacote inicial do painel ficou em aproximadamente 303 kB
antes de compressão, enquanto o módulo cartográfico permanece isolado na rota do mapa. O aviso
de chunk acima de 500 kB corresponde ao motor cartográfico e não afeta login, visão geral ou fila.

## Validação executada

### Painel municipal

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- `npm run validate`: aprovado.
- Prettier: todos os arquivos verificados estão formatados.
- Auditoria da instalação: zero vulnerabilidades.

### Back-end

- `npm run lint`: aprovado.
- `npm test`: 210 testes aprovados em 40 arquivos.
- `npm run build`: aprovado.
- `npm run validate`: aprovado.

### Navegador

- Login operacional e carregamento dos cinco contratos reais aprovados.
- Mapa-base com ruas, bairros, zoom, atribuição e camada de calor aprovado.
- Filtro por categoria reduziu corretamente o recorte de cinco para uma ocorrência.
- URL preservou o filtro aplicado e voltou ao estado base após `Limpar`.
- Rankings, indicadores e status foram recalculados conforme o filtro.
- Navegação entre `Ocorrências` e `Mapa de calor` aprovada.
- Nenhuma mutação de dados foi executada.

## Roteiro visual

1. Abra `http://localhost:5174/?view=heatmap`.
2. Confira as ruas, a mancha de calor e as células numeradas.
3. Aplique um filtro de categoria, bairro ou status.
4. Confira a contagem, o bairro líder e os rankings atualizados.
5. Clique em `Limpar` para retornar a toda a base municipal.
6. Teste a navegação entre visão geral, ocorrências e mapa de calor.
7. Reduza a largura do navegador para conferir o layout mobile.
