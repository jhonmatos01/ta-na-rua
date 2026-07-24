# Roteiro de demonstração — aplicativo cidadão

Este roteiro apresenta a versão candidata da FE‑7 usando somente serviços e dados fictícios do ambiente local.

## 1. Iniciar após reiniciar o computador

Abra o Docker Desktop e aguarde até o mecanismo ficar disponível. Em um terminal na raiz do repositório:

```powershell
npm run docker:up
npm run dev
```

Mantenha esse terminal aberto para a API. Em um segundo terminal:

```powershell
Set-Location apps/citizen-web
npm run dev
```

Abra `http://localhost:5173`. Se o navegador informar que o site não pode ser carregado, confirme que os dois terminais continuam abertos e execute novamente os comandos acima. Os serviços locais esperados são:

| Serviço            | Endereço                     |
| ------------------ | ---------------------------- |
| Aplicativo cidadão | `http://localhost:5173`      |
| API                | `http://localhost:3333`      |
| Swagger            | `http://localhost:3333/docs` |
| Adminer            | `http://localhost:8080`      |

## 2. Preparar os dados de demonstração

Se o banco ainda não recebeu o seed da versão ou foi criado novamente, execute na raiz:

```powershell
npm run db:migrate
npm run db:seed
npm run db:validate
```

O seed é idempotente e bloqueado em produção. Para a jornada cidadã local, use a conta fictícia documentada no README da raiz:

- e-mail: `ana.cidada@example.test`;
- senha local de demonstração: `Cidada123!Fase2`.

## 3. História da demonstração

1. **Entender a proposta:** abra a página inicial e mostre os atalhos para mapa, registro e acompanhamento.
2. **Explorar a cidade:** abra **Mapa**, aplique filtros e aproxime para mostrar ruas, bairros e ocorrências públicas.
3. **Ver transparência:** abra uma ocorrência e mostre protocolo, prioridade, confirmações, linha do tempo e resumo de avaliações sem dados pessoais.
4. **Entrar com segurança:** faça login e explique que o access token fica em memória e o refresh token permanece em cookie `httpOnly`.
5. **Participar:** use **Eu também vi** em uma ocorrência confirmável e mostre a atualização do contador. Remova a confirmação se quiser repetir a demonstração.
6. **Registrar:** abra **Reportar**, adicione uma imagem de teste, obtenha ou marque a localização, revise o endereço aproximado e confira candidatos próximos antes do envio.
7. **Acompanhar:** abra **Minhas ocorrências** para ver registros próprios, confirmações e avaliações pendentes.
8. **Receber retorno:** abra **Avisos**, filtre itens não lidos e marque um aviso como lido.
9. **Avaliar o reparo:** abra uma ocorrência resolvida relacionada à conta e mostre nota, resolução, qualidade opcional e comentário.
10. **Instalar:** abra o perfil e mostre o cartão de instalação do PWA ou as instruções alternativas do navegador.

## 4. Verificação técnica antes da apresentação

No aplicativo cidadão:

```powershell
npm run validate:release
```

Na raiz do repositório:

```powershell
npm run validate
```

Todos os comandos devem terminar com código zero. O relatório completo da fase fica em [FE7_VALIDACAO.md](FE7_VALIDACAO.md).

## 5. Limites transparentes da versão candidata

- O aplicativo entregue é o front-end cidadão; painéis de operador e administrador são produtos separados.
- O mapa depende de um estilo cartográfico externo configurável e precisa de internet para carregar os blocos do mapa no desenvolvimento local.
- Geolocalização do dispositivo pode variar; a pessoa sempre pode corrigir o marcador e a referência manualmente.
- Notificações push externas, recuperação de senha, verificação de e-mail e MFA não fazem parte do MVP atual.
