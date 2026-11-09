import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GH_BRANCH, contentsUrl, gh, githubError, useGitHub } from "./github";

// Quem pode entrar no site e receber as notificações. Fica fora do código
// (este repositório é público), em membros.json:
//
//   - GitHub: raiz do repositório privado de dados, ao lado do agenda.json;
//   - local:  .data/membros.json (mesma pasta de DATA_FILE).
//
//   {
//     "297994": { "nome": "Dannilo Neiva de Carvalho", "email": "fulano@hotmail.com" }
//   }
//
// A chave é o CIM usado no login; "nome" identifica o irmão nas telas e nos
// e-mails; "email" vazio = não recebe notificações.
//
// Lido do GitHub no máximo uma vez por minuto (cache em memória): incluir ou
// tirar alguém vale em até 1 minuto, sem deploy. Se o GitHub falhar, usa a
// última versão lida.

const FILE_NAME = "membros.json";
const TTL_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCAL_FILE = path.resolve(
  /* turbopackIgnore: true */ path.dirname(process.env.DATA_FILE || path.join(".data", "agenda.json")),
  FILE_NAME,
);

async function readRaw() {
  if (useGitHub) {
    const res = await gh(`${contentsUrl(FILE_NAME)}?ref=${encodeURIComponent(GH_BRANCH)}`, {
      headers: { Accept: "application/vnd.github.raw+json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw await githubError("read", res);
    return res.text();
  }
  try {
    return await fs.readFile(/* turbopackIgnore: true */ LOCAL_FILE, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function parse(raw) {
  if (raw == null) {
    console.error(`${FILE_NAME} não encontrado: ninguém consegue entrar no site.`);
    return new Map();
  }
  const data = JSON.parse(raw); // JSON inválido → erro (mantém a versão anterior)
  const members = new Map();
  for (const [key, value] of Object.entries(data ?? {})) {
    const cim = key.trim();
    if (!/^\d+$/.test(cim) || typeof value !== "object" || value === null) continue;
    const name = String(value.nome ?? "").trim() || cim;
    const email = String(value.email ?? "").trim();
    members.set(cim, { cim, name, email: EMAIL_RE.test(email) ? email : null });
  }
  return members;
}

let cache = null; // { members, at }
let inflight = null;

/** Map(CIM → { cim, name, email|null }). */
export async function readMembers() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.members;
  inflight ??= (async () => {
    try {
      const members = parse(await readRaw());
      cache = { members, at: Date.now() };
      return members;
    } catch (err) {
      if (cache) {
        console.error(`Falha ao ler ${FILE_NAME}; usando a versão anterior.`, err);
        return cache.members;
      }
      throw err;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getMember(cim) {
  if (cim == null) return null;
  return (await readMembers()).get(String(cim).trim()) ?? null;
}
