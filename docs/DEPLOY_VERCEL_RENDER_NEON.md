# Homologação: Vercel, Render e Neon

Esta configuração prepara uma versão de testes com HTTPS, API e banco reais. Ainda não há um endereço publicado. A publicação exige as contas do proprietário e envio dos commits locais ao GitHub. Não compartilhe senhas, connection strings ou chaves em chats/issues; informe-as nos campos protegidos dos provedores.

## Arquitetura

- Vercel: projeto com **Root Directory `frontend`**, Vite, saída `dist`.
- Render: API Docker usando `render.yaml` na raiz, uma instância.
- Neon: PostgreSQL/PostGIS novo, separado do banco de desenvolvimento.
- Bucket S3 privado: armazenamento adicional necessário para originais e cópias sanitizadas. Cloudflare R2 é uma opção compatível; não ative acesso público ou domínio público do bucket.

A Vercel encaminha `/api/*` e `/uploads/*` à Render por rewrites externos. O navegador usa a mesma origem HTTPS, preservando o cookie HttpOnly de refresh. Não usamos uma função Vercel como proxy de uploads. Nenhuma chave de banco, JWT ou S3 vai para o frontend.

Os planos gratuitos e suas limitações precisam ser conferidos nos painéis atuais. Render pode suspender a API após inatividade; Neon também pode suspender o compute. R2 pode exigir ativação de cobrança. Nenhum plano pago ou serviço foi criado automaticamente nesta entrega.

## 1. Repositório

Envie ao GitHub o código atualizado, incluindo `render.yaml`, `frontend/vercel.json`, migrations e bootstrap. Os commits feitos nesta sessão estão somente no workspace até esse envio. Não envie `.env`, dumps do banco local nem arquivos de upload. Vercel/Render devem importar a revisão atualizada, não apenas o commit anterior do repositório remoto.

## 2. Neon

Crie um projeto/banco dedicado ao piloto. Copie a URL PostgreSQL **direta, sem pooler**, com TLS, para o campo protegido `DATABASE_URL` da Render. A migration inicial executa `CREATE EXTENSION IF NOT EXISTS postgis`; confirme que a extensão está disponível no projeto escolhido. Não execute o seed de desenvolvimento: ele é bloqueado em produção.

## 3. Bucket privado

Crie um bucket R2 privado e uma credencial com acesso de leitura/escrita/exclusão apenas nesse bucket. Configure na Render:

| Variável                  | Valor                                               |
| ------------------------- | --------------------------------------------------- |
| `STORAGE_BUCKET`          | Nome do bucket privado                              |
| `STORAGE_ENDPOINT`        | Endpoint S3 fornecido pelo R2, sem o nome do bucket |
| `STORAGE_REGION`          | `auto` para R2; ajuste se usar outro provedor       |
| `STORAGE_ACCESS_KEY`      | Access key da credencial restrita                   |
| `STORAGE_SECRET_KEY`      | Secret key da credencial restrita                   |
| `STORAGE_PUBLIC_BASE_URL` | URL HTTPS da API Render, seguida de `/uploads`      |

Apesar do nome histórico `PUBLIC_BASE_URL`, o bucket permanece privado. A aplicação expõe somente rotas com controle de acesso. Não é preciso configurar CORS público no bucket porque uploads e downloads passam pela API. Os originais nunca são servidos anonimamente.

## 4. Render

Importe o repositório pelo fluxo de Blueprint, usando `render.yaml`. Antes do deploy, preencha os campos `sync: false`. `CORS_ORIGIN` deve ser a origem HTTPS exata do projeto Vercel. Se o endereço definitivo ainda não existir, reserve/crie o projeto Vercel e use seu domínio; ajuste depois se necessário.

O Blueprint mantém `NODE_ENV=production`, mas usa `DEPLOYMENT_PROFILE=pilot`: IA, Telegram, WhatsApp e n8n ficam sem configuração e continuam recusando chamadas de integração. O atendimento usa revisão manual. Não configure URLs/segredos falsos para satisfazer validação. HTTPS, segredo JWT próprio, rejeição de placeholders e storage S3 continuam obrigatórios. O perfil padrão `full` preserva as exigências anteriores.

A Render gera `JWT_ACCESS_SECRET`. O comando Docker aplica migrations antes de iniciar a API; a execução do piloto é de uma instância. Sem pre-deploy pago, essa é a estratégia inicial. A health check consulta `/health/database`.

`TRUST_PROXY_HOPS=1` confia somente no proxy imediato da Render. Com a Vercel na frente, o limite de requisições pode agrupar tráfego por IP do proxy. Valide a cadeia real antes de mudar esse valor; não aumente cegamente, pois a URL da API também é acessível diretamente.

### Inicialização do banco sem contas de demonstração

Para o primeiro deploy, acrescente no painel Render:

| Variável                   | Como preencher                                   |
| -------------------------- | ------------------------------------------------ |
| `PILOT_BOOTSTRAP`          | `true`                                           |
| `BOOTSTRAP_ADMIN_NAME`     | Seu nome para a conta administrativa             |
| `BOOTSTRAP_ADMIN_EMAIL`    | Seu e-mail de acesso                             |
| `BOOTSTRAP_ADMIN_PASSWORD` | Senha própria, pelo menos 12 caracteres          |
| `PILOT_CITY_NAME`          | Município escolhido para os testes               |
| `PILOT_CITY_STATE`         | UF em maiúsculas                                 |
| `PILOT_CITY_IBGE`          | Código IBGE de 7 dígitos                         |
| `PILOT_CITY_LATITUDE`      | Latitude do centro municipal, decimal com ponto  |
| `PILOT_CITY_LONGITUDE`     | Longitude do centro municipal, decimal com ponto |

Exemplo de município, a confirmar conforme seu piloto: Salvador / BA / 2927408 / -12.977749 / -38.501629. Nenhuma cidade é criada automaticamente sem esses parâmetros.

O bootstrap cria um município, 11 categorias de infraestrutura, um departamento inicial e um ADMIN ativo, com hash Argon2 e auditoria. Não cria ocorrências, avaliações, imagens ou contas fictícias. Não marca o e-mail como verificado. Bairros precisam ser cadastrados depois; o registro aceita informação textual do bairro.

O bootstrap recusa banco já preenchido sem sua marca de inicialização. Se o mesmo administrador já foi criado por este bootstrap, a repetição não duplica nem altera senha/dados. Após o primeiro sucesso, remova `PILOT_BOOTSTRAP` e todas as variáveis `BOOTSTRAP_ADMIN_*` e `PILOT_CITY_*` do serviço. Não use bootstrap para redefinir senha.

O comando `npm run db:bootstrap:pilot` também executa a inicialização após build, caso tenha acesso administrativo ao ambiente. Não é necessário usar shell pago da Render: o comando Docker do Blueprint já contempla a primeira inicialização.

## 5. Vercel

Importe o mesmo repositório e selecione **Root Directory `frontend`**. Framework Vite, Build Command `npm run build`, Output Directory `dist`. Não é necessário definir `VITE_*` com segredos ou URLs da API.

Antes de publicar, substitua **as duas ocorrências** de `https://ta-na-rua-api.onrender.com` em `frontend/vercel.json` pelo endereço real atribuído ao serviço Render. O endereço no arquivo é um modelo; sua disponibilidade não foi confirmada nem representa um serviço já criado.

Depois do deploy, use o domínio HTTPS da Vercel no celular. Links de ocorrência usam fragmentos (`/#occurrence/UUID`) e continuam abrindo a interface.

## 6. Verificação no ambiente publicado

1. API: `/health`, `/health/database` e `/docs/openapi.json` devem responder.
2. Pelo domínio Vercel: `/api/v1/catalog/municipalities` deve trazer o município inicializado.
3. Entre com seu administrador, recarregue a página e confira a sessão. Verifique cookie Secure/HttpOnly e logout.
4. Crie uma conta cidadã própria e registre uma ocorrência com foto pelo celular; a IA deve indicar revisão manual.
5. Sem autenticação, foto pendente e rota do original devem estar protegidas. Aprove a cópia e publique a ocorrência pela moderação; somente a cópia sanitizada fica acessível ao público.
6. Revogue a aprovação e confira o bloqueio. Tente ler a chave diretamente no bucket: deve ser negado.
7. Acesse um link compartilhado de ocorrência e valide o ciclo de atendimento/avaliação.

Essas verificações externas dependem dos serviços reais e não são substituídas pelos testes locais. O piloto ainda não corresponde à aprovação final da Fase 11.

## Estado desta preparação

Configurações de Vercel/Render, perfil de piloto e bootstrap incluídos no repositório. Nenhuma conta de provedor conectada, segredo real configurado, push GitHub ou publicação externa efetuados nesta sessão. Próxima etapa: conectar as contas, preencher os campos protegidos e executar a publicação, seguida das verificações acima.

Validação desta preparação: lint, 223 testes do backend, build TypeScript e Vite, formatação e migration/bootstrap em banco PostgreSQL/PostGIS temporário aprovados. O bootstrap foi executado duas vezes e permaneceu com um administrador, um município, 11 categorias e uma auditoria de inicialização. A imagem Docker e os serviços externos ainda precisam ser validados nos provedores. A verificação `gh auth status` rejeitou a autenticação disponível; nenhum token foi exposto ou substituído.
