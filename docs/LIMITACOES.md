# Limitacoes conhecidas do MVP

Data de referencia: 20 de julho de 2026.

- Nenhum provedor, dominio ou conta de deploy foi informado. A imagem e o compose de producao sao entregues e validados localmente, sem publicacao externa.
- IA, n8n e S3 de producao nao foram fornecidos. Clientes, contratos, timeout, retry e fallback foram testados com dependencias controladas.
- Telegram e WhatsApp usam webhooks normalizados; bots conversacionais completos sao adicionais no PRD.
- O webhook de status nao altera a maquina de estados. Alteracoes operacionais continuam nas rotas autenticadas.
- O rate limit global usa memoria do processo. Escala horizontal requer um limitador compartilhado no gateway, WAF ou Redis.
- A fila usa PostgreSQL. Broker distribuido, dead-letter queue externa e replay administrativo avancado estao fora do MVP.
- Upload aceita apenas JPEG, PNG e WebP e valida assinatura MIME, mas nao inclui antivirus ou CDR.
- O mapa de calor usa celulas de 250 metros e a exportacao do MVP aceita apenas CSV com ate 10.000 linhas.
- Recuperacao de senha, verificacao de e-mail, MFA e notificacoes push externas nao foram definidas como entregas do MVP.
- Exclusao de conta e logica para preservar auditoria e integridade referencial; politicas de retencao e anonimizacao definitiva dependem da governanca LGPD do controlador.
- Merge/separacao complexa de duplicidades, revisao nacional de municipios e contestacao administrativa avancada permanecem adicionais.
- Adminer e credenciais ficticias existem apenas no ambiente local. O compose de producao nao publica Adminer nem a porta do PostgreSQL.
- Backup, TLS, DNS, WAF, monitoramento centralizado, cofre de segredos e rotacao automatica pertencem a infraestrutura de destino.
