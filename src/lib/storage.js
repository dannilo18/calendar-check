import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// Sem banco de dados: eventos e confirmações ficam num único JSON.
//
//   - padrão: arquivo local (DATA_FILE, padrão .data/agenda.json).
//     Funciona em qualquer servidor com disco persistente (VPS, máquina
//     própria, Docker com volume). Não exige conta em lugar nenhum.
//
//   - opcional (GITHUB_TOKEN + GITHUB_REPO): arquivo num repositório GitHub
//     PRIVADO. Para hospedagens sem disco persistente (ex.: Vercel).
//     Cada alteração vira um commit; o `sha` do arquivo garante que duas
//     escritas simultâneas não se sobrescrevam (conflito → relê e tenta de novo).
//
// Formato:
//   {
//     events:      [{ id, title, description, event_date, event_time,
//                     location, created_at, updated_at }],
//     attendances: [{ event_id, cim, name, created_at }]
//   }

const MAX_RETRIES = 5;

function withDefaults(data) {
  return {
    events: Array.isArray(data?.events) ? data.events : [],
    attendances: Array.isArray(data?.attendances) ? data.attendances : [],
  };
}

class ConflictError extends Error {}

// ---------------------------------------------------------------------------
// Arquivo local
// ---------------------------------------------------------------------------

const LOCAL_FILE = path.resolve(process.env.DATA_FILE || path.join(".data", "agenda.json"));

const localBackend = {
  async read() {
    try {
      return { data: withDefaults(JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"))) };
    } catch (err) {
      if (err.code === "ENOENT") return { data: withDefaults() };
      throw err;
    }
  },
  async write(data) {
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    // Grava em arquivo temporário e renomeia: nunca deixa o JSON pela metade.
    const tmp = `${LOCAL_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, LOCAL_FILE);
  },
};

// ---------------------------------------------------------------------------
// GitHub (repositório privado)
// ---------------------------------------------------------------------------

const GH_REPO = process.env.GITHUB_REPO; // "dono/repositorio"
const GH_BRANCH = process.env.GITHUB_BRANCH || "main";
const GH_PATH = process.env.GITHUB_PATH || "agenda.json";

async function gh(url, init = {}) {
  return fetch(`https://api.github.com/repos/${GH_REPO}${url}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "calendar-check",
      ...init.headers,
    },
  });
}

const contentsUrl = `/contents/${GH_PATH.split("/").map(encodeURIComponent).join("/")}`;

// Transforma uma resposta de erro do GitHub numa mensagem que diz o que
// corrigir na configuração.
async function githubError(op, res) {
  const text = await res.text();
  let message = text;
  try {
    message = JSON.parse(text).message ?? text;
  } catch {}

  const hints = {
    401: "GITHUB_TOKEN inválido ou expirado. Gere um novo token.",
    403: 'O token não tem permissão de escrita. Em "Repository permissions", "Contents" deve ser "Read and write".',
    404: `Repositório "${GH_REPO}" ou branch "${GH_BRANCH}" não encontrado, ou o token não tem acesso a ele. Confira GITHUB_REPO (formato dono/repositorio), GITHUB_BRANCH e se o token inclui esse repositório em "Repository access".`,
  };
  const hint = hints[res.status] ?? "";
  return new Error(`GitHub ${op} ${res.status}: ${message}${hint ? ` — ${hint}` : ""}`);
}

// Um 404 na leitura pode ser "arquivo ainda não existe" (normal no primeiro
// uso) ou "repositório/branch inacessível" (configuração errada). Confere a
// branch para distinguir os dois casos, uma vez por instância.
let branchChecked = false;
async function ensureBranchAccessible() {
  if (branchChecked) return;
  const res = await gh(`/branches/${encodeURIComponent(GH_BRANCH)}`);
  if (!res.ok) throw await githubError("read", res);
  branchChecked = true;
}

const githubBackend = {
  async read() {
    const res = await gh(`${contentsUrl}?ref=${encodeURIComponent(GH_BRANCH)}`);
    if (res.status === 404) {
      await ensureBranchAccessible();
      return { data: withDefaults(), sha: null };
    }
    if (!res.ok) throw await githubError("read", res);
    const body = await res.json();
    const json = Buffer.from(body.content, "base64").toString("utf8");
    return { data: withDefaults(JSON.parse(json)), sha: body.sha };
  },
  async write(data, sha) {
    const res = await gh(contentsUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "agenda: atualização",
        content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
        branch: GH_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    // 409: sha desatualizado. 422 com "sha": arquivo criado por outra escrita
    // no meio. Os dois são conflito de concorrência → relê e tenta de novo.
    if (res.status === 409) throw new ConflictError();
    if (res.status === 422) {
      const err = await githubError("write", res);
      if (/sha/i.test(err.message)) throw new ConflictError();
      throw err;
    }
    if (!res.ok) throw await githubError("write", res);
  },
};

// ---------------------------------------------------------------------------

const useGitHub = !!(process.env.GITHUB_TOKEN && GH_REPO);
const backend = useGitHub ? githubBackend : localBackend;

export async function readAgenda() {
  return (await backend.read()).data;
}

// Serializa as escritas dentro do mesmo processo (suficiente para o arquivo
// local; no GitHub o `sha` cobre também processos diferentes).
let queue = Promise.resolve();

// Lê, aplica `mutate(data)` e grava. `mutate` altera `data` no lugar e pode
// devolver um valor; se lançar, nada é gravado.
export function updateAgenda(mutate) {
  const run = queue.then(async () => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data, sha } = await backend.read();
      const result = await mutate(data);
      try {
        await backend.write(data, sha);
        return result;
      } catch (err) {
        if (!(err instanceof ConflictError)) throw err;
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1) + Math.random() * 200));
      }
    }
    throw new Error("Não foi possível salvar: muitas alterações simultâneas.");
  });
  queue = run.catch(() => {});
  return run;
}

export function newId() {
  return randomUUID();
}
