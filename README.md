# calendar-check

Agenda privada com calendário e confirmação de presença, e acervo de
documentos da chapa (documentos de decisão e identidade visual).

- **Sem banco de dados e sem conta em serviço nenhum.** Eventos e
  confirmações ficam num único arquivo JSON (`.data/agenda.json`).
- **Sem senha.** O login pede CIM e a palavra de verificação definida em
  `PALAVRA_VERIFICACAO`. Só entram os CIMs de `membros.json` (ver abaixo),
  que também dá o nome exibido e o e-mail das notificações. A comparação da
  palavra ignora maiúsculas, acentos e espaços nas pontas.
- **Sessão** em cookie assinado (HMAC derivado da palavra). Trocar a palavra
  derruba todas as sessões. Tirar um CIM de `membros.json` corta o acesso em
  até 1 minuto.

## Membros (`membros.json`)

Fica na raiz do repositório privado de dados, ao lado do `agenda.json`
(localmente, em `.data/membros.json`). Não fica neste repositório, que é
público.

```json
{
  "297994": { "nome": "Dannilo Neiva de Carvalho", "email": "fulano@hotmail.com" },
  "237622": { "nome": "Fulano de Tal", "email": "" }
}
```

- A chave é o CIM do login; `nome` identifica o irmão no cabeçalho, nas
  confirmações de presença e nos e-mails; `email` vazio = não recebe
  notificações.
- Editar o arquivo no GitHub vale em até 1 minuto, sem deploy.
- Sem o arquivo ninguém entra. Com JSON inválido, o site continua usando a
  última versão lida (erro no log); logo após um deploy, sem versão anterior,
  o login fica indisponível até o arquivo ser corrigido.

## Rotas

| Rota           | O que faz                                            |
| -------------- | ---------------------------------------------------- |
| `/login`       | CIM + palavra de verificação                         |
| `/`            | Calendário, lista de eventos, confirmação de presença |
| `/novo`        | Novo evento                                          |
| `/evento/[id]` | Editar / excluir evento                              |
| `/documentos`  | Documentos de decisão (markdown): lista e busca      |
| `/documentos/novo`, `/documentos/[nome]`, `/documentos/[nome]/editar` | Criar, ler, editar / renomear / excluir |
| `/documentos/[nome]/word`, `/documentos/[nome]/pdf` | Baixa o documento como Word (.docx) ou PDF |
| `/identidade-visual`, `/identidade-visual/gestao` | Galeria de imagens / enviar e excluir |
| `/api/lembretes` | Lembrete da véspera (cron diário; exige `CRON_SECRET`) |
| `/arquivos/[categoria]/[arquivo]` | Serve os arquivos (só com sessão; `?baixar=1` força download) |

O menu lateral segue o do Portal do GOB-PI (seção > grupo > ação).

## Acervo de documentos

- **Decisões**: editor visual no estilo do Word (estilos de título, negrito,
  itálico, sublinhado, listas, tarefas, tabelas, links), sem precisar saber
  markdown. Ctrl/Cmd+S salva; aviso ao sair sem salvar. **Importar do Word**
  traz o texto de um `.docx` (imagens não vêm). **Baixar em Word** gera um
  `.docx` (A4, Calibri 11) e **Baixar em PDF** gera um PDF (A4, com título,
  data da última alteração e número de página). Por baixo o arquivo continua em markdown (`.md`),
  legível no GitHub e no histórico de commits. O título é o nome do arquivo.
- **Imagens** da identidade visual (PNG, JPG, WEBP, GIF, SVG): envio de até
  4 MB por arquivo (limite de corpo da Vercel). Nome repetido pergunta se substitui
  ou mantém os dois.
- Qualquer membro logado pode criar, editar e excluir, como na agenda.
- Se duas pessoas editam o mesmo documento, a segunda a salvar recebe um
  aviso e o texto dela continua na tela; nada é sobrescrito.

## Notificações por e-mail

Evento novo, documento novo e imagem nova na identidade visual geram um
e-mail para todos os membros com e-mail cadastrado, menos quem fez a
alteração (todos em cópia oculta). Edições não notificam. O envio acontece
depois da resposta, então não atrasa quem salvou; falhas vão só para o log.

1. Crie uma conta Gmail para a chapa e ative a verificação em duas etapas.
2. Gere uma senha de app em myaccount.google.com/apppasswords.
3. Preencha `GMAIL_USER`, `GMAIL_APP_PASSWORD` e, de preferência, `SITE_URL`.
4. Preencha o `email` de cada irmão em `membros.json`.

### Lembrete da véspera

Todo dia às 15h (horário de Fortaleza), quem confirmou presença num evento
do dia seguinte recebe um lembrete com data, horário, local e descrição.
Só recebe quem confirmou e tem e-mail em `membros.json`. Confirmar depois
das 15h da véspera não gera lembrete.

- Agendado pelo cron da Vercel (`vercel.json`), que chama `/api/lembretes`.
  No plano gratuito a Vercel pode disparar a qualquer momento entre 15h e
  15h59.
- Preencha `CRON_SECRET` na Vercel (`openssl rand -hex 32`); sem ele a rota
  responde 401 e nada é enviado.
- Cada evento é lembrado uma vez só (`reminder_sent_for` no `agenda.json`);
  se a data mudar, ele é lembrado de novo na nova véspera.
- Para disparar na mão:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://SEU-SITE/api/lembretes`

E-mails vazios ou inválidos não recebem. Limite do Gmail gratuito: ~500
destinatários/dia.

## Configuração

Copie `.env.example` para `.env.local` e preencha:

```
PALAVRA_VERIFICACAO=...
```

### Onde os dados ficam

**Padrão: arquivo local** (`DATA_FILE`, padrão `.data/agenda.json`; acervo em
`FILES_DIR`, padrão `.data/documentos/`). Não
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
simultâneas se sobrescrevam. O acervo fica em `documentos/` no mesmo
repositório (mude com `GITHUB_FILES_PATH`), com as subpastas `decisoes/` e
`identidade-visual/`. Os commits do acervo saem com o nome do
membro como autor, então o histórico do GitHub mostra quem mudou o quê.
Arquivos colocados direto no repositório (por `git push`) aparecem no app.

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
