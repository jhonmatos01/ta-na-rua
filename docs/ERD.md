# Diagrama ER - Modelo final do MVP

O diagrama apresenta os relacionamentos fisicos do schema final com 18 tabelas. Colunas de auditoria e integracao com entidades genericas usam `entity_type` e `entity_id` e, por isso, nao possuem chave estrangeira polimorfica.

```mermaid
erDiagram
    municipalities ||--o{ neighborhoods : possui
    municipalities ||--o{ departments : possui
    municipalities ||--o{ users : vincula
    municipalities ||--o{ occurrences : delimita

    categories ||--o{ occurrences : classifica
    neighborhoods ||--o{ occurrences : localiza
    departments ||--o{ occurrences : atende

    users ||--o{ refresh_tokens : possui
    users ||--o{ occurrences : cria
    users ||--o{ occurrence_reports : reporta
    users ||--o{ occurrence_images : envia
    users ||--o{ occurrence_confirmations : confirma
    users ||--o{ occurrence_status_history : altera
    users ||--o{ repair_evaluations : avalia
    users ||--o{ ai_analyses : revisa
    users ||--o{ notifications : recebe
    users ||--o{ audit_logs : executa

    occurrences ||--o{ occurrence_reports : agrega
    occurrences ||--o{ occurrence_images : documenta
    occurrences ||--o{ occurrence_confirmations : recebe
    occurrences ||--o{ occurrence_status_history : historico
    occurrences ||--o{ repair_evaluations : avaliacoes
    occurrences ||--o{ ai_analyses : analises
    occurrences o|--o{ occurrences : duplicidade

    occurrence_reports ||--o{ occurrence_images : inclui
    occurrence_reports ||--o{ ai_analyses : analises
```

Tabelas sem relacionamento fisico direto:

- `protocol_counters`: controla a sequencia anual de protocolos;
- `webhook_events`: garante idempotencia de eventos externos;
- `outbox_events`: prepara entrega transacional para n8n e outras integracoes.

Detalhes de enums, constraints e indices ficam nas migrations versionadas e em `src/database/schema`.
