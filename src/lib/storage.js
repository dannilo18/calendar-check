import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ConflictError,
  GH_BRANCH,
  contentsUrl,
  ensureBranchAccessible,
  gh,
  githubError,
  throwWriteError,
  useGitHub,
} from "./github";

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

const GH_PATH = process.env.GITHUB_PATH || "agenda.json";
const agendaUrl = contentsUrl(GH_PATH);

const githubBackend = {
  async read() {
    const res = await gh(`${agendaUrl}?ref=${encodeURIComponent(GH_BRANCH)}`);
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
    const res = await gh(agendaUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "agenda: atualização",
        content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
        branch: GH_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) await throwWriteError(res);
  },
};

// ---------------------------------------------------------------------------

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
