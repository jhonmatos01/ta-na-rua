# Imagens dos chamados de demonstração

Estas imagens são ativos fictícios, criados especificamente para a demonstração local do Tá na Rua!. Elas não representam pessoas, endereços ou ocorrências reais.

O comando `npm run db:seed`:

1. copia os arquivos para `tmp/uploads/fixtures/phase-1`;
2. atualiza de forma idempotente os registros de `occurrence_images`;
3. expõe os arquivos pela rota local `/uploads`;
4. mantém os dois chamados determinísticos do seed apontando para imagens válidas.

Ativos:

- `pothole-before-repair.png`: imagem inicial do chamado de buraco em via;
- `streetlight-after-repair.png`: imagem posterior ao reparo do chamado de iluminação.

O seed é bloqueado em produção e a cópia dos ativos de demonstração exige `STORAGE_PROVIDER=local`.
