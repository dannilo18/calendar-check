# calendar-check

Agenda privada com calendário e confirmação de presença, e acervo de
documentos da chapa (documentos de decisão e identidade visual).

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
| `/documentos`  | Documentos de decisão (markdown): lista e busca      |
| `/documentos/novo`, `/documentos/[nome]`, `/documentos/[nome]/editar` | Criar, ler, editar / renomear / excluir |
| `/documentos/[nome]/word`, `/documentos/[nome]/pdf` | Baixa o documento como Word (.docx) ou PDF |
| `/identidade-visual`, `/identidade-visual/gestao` | Galeria de imagens / enviar e excluir |
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
