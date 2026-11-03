# calendar-check

Agenda privada com calendário e confirmação de presença.

- **Sem banco de dados e sem conta em serviço nenhum.** Eventos e
  confirmações ficam num único arquivo JSON (`.data/agenda.json`).
- **Sem senha.** O login pede CIM e a palavra de verificação definida em
  `PALAVRA_VERIFICACAO`. Só entram os CIMs de `src/lib/config.js`, onde também
  ficam os nomes exibidos nas confirmações. A comparação ignora maiúsculas, acentos e espaços nas pontas.
- **Sessão** em cookie assinado (HMAC derivado da palavra). Trocar a palavra
  derruba todas as sessões. Tirar um CIM da lista corta o acesso na hora.

## Rotas

| Rota           | O que faz                                            |
| -------------- | ---------------------------------------------------- |
| `/login`       | CIM + palavra de verificação                         |
| `/`            | Calendário, lista de eventos, confirmação de presença |
| `/novo`        | Novo evento                                          |
| `/evento/[id]` | Editar / excluir evento                              |

## Configuração

Copie `.env.example` para `.env.local` e preencha:

```
PALAVRA_VERIFICACAO=...
```

### Onde os dados ficam

**Padrão: arquivo local** (`DATA_FILE`, padrão `.data/agenda.json`). Não
precisa de conta nem configuração. Exige um servidor com disco que persiste
entre reinícios: VPS, máquina própria, Docker com volume. **Não funciona na
Vercel** nem em outra hospedagem serverless, onde o disco é apagado.

**Opcional: repositório GitHub privado.** Para hospedar na Vercel. Usa a
conta do GitHub que já existe, sem criar conta nova:

1. Crie um repositório **privado** só para os dados. Não use este repositório,
   que é público.
2. Crie um token fine-grained com acesso só a esse repositório e permissão
   *Contents: Read and write*.
3. Preencha `GITHUB_TOKEN` e `GITHUB_REPO` (e, se quiser, `GITHUB_BRANCH` e
   `GITHUB_PATH`).

Cada alteração vira um commit. O `sha` do arquivo impede que duas escritas
simultâneas se sobrescrevam.

## Rodando

```
npm install
npm run dev
```

## Formato do JSON

```json
{
  "events": [
    {
      "id": "uuid",
      "title": "…",
      "description": "…",
      "event_date": "2026-11-20",
      "event_time": "19:30",
      "location": "…",
      "created_at": "…",
      "updated_at": "…"
    }
  ],
  "attendances": [
    { "event_id": "uuid", "cim": "297994", "created_at": "…" }
  ]
}
```
