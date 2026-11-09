import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ConflictError,
  GH_BRANCH,
  contentsUrl,
  GH_REPO,
  ensureBranchAccessible,
  gh,
  githubError,
  throwWriteError,
  useGitHub,
} from "./github";

// Armazenamento de arquivos (documentos, PDFs, imagens), com os mesmos dois
// backends da agenda:
//
//   - padrão: pasta local (FILES_DIR, padrão .data/documentos).
//   - GITHUB_TOKEN + GITHUB_REPO: pasta GITHUB_FILES_PATH (padrão
//     "documentos") do repositório privado. Cada alteração vira um commit
//     assinado com o nome do membro, então o histórico do GitHub é a
//     auditoria de quem mudou o quê.
//
// Toda escrita leva o `sha` da versão que o usuário tinha em mãos: se outra
// pessoa salvou no meio, a escrita falha com ConflictError em vez de
// sobrescrever o trabalho dela. sha null = "criar; não pode existir ainda".

export { ConflictError };

// sha de blob no mesmo formato do git, para o backend local se comportar
// igual ao GitHub.
function blobSha(buffer) {
  return createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
}

// ---------------------------------------------------------------------------
// Pasta local
// ---------------------------------------------------------------------------

const LOCAL_ROOT = path.resolve(/* turbopackIgnore: true */ process.env.FILES_DIR || path.join(".data", "documentos"));

function localPath(filePath) {
  const full = path.resolve(LOCAL_ROOT, filePath);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Caminho inválido.");
  return full;
}

// O backend local não tem histórico de commits: o autor da última alteração
// de cada arquivo fica em <pasta>/.autores.json (oculto na listagem).
const AUTHORS_FILE = ".autores.json";

async function readAuthors(folder) {
  try {
    return JSON.parse(await fs.readFile(/* turbopackIgnore: true */ localPath(`${folder}/${AUTHORS_FILE}`), "utf8"));
  } catch {
    return {};
  }
}

async function setAuthor(filePath, author) {
  const folder = path.posix.dirname(filePath);
  const name = path.posix.basename(filePath);
  const authors = await readAuthors(folder);
  if (author) authors[name] = author.name;
  else delete authors[name];
  await fs.writeFile(
    /* turbopackIgnore: true */ localPath(`${folder}/${AUTHORS_FILE}`),
    JSON.stringify(authors, null, 2),
  );
}

const localBackend = {
  async list(folder) {
    let entries;
    try {
      entries = await fs.readdir(/* turbopackIgnore: true */ localPath(folder), { withFileTypes: true });
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
    const files = entries.filter((e) => e.isFile() && !e.name.startsWith("."));
    return Promise.all(
      files.map(async (e) => {
        const filePath = `${folder}/${e.name}`;
        const buffer = await fs.readFile(/* turbopackIgnore: true */ localPath(filePath));
        return { name: e.name, path: filePath, size: buffer.length, sha: blobSha(buffer) };
      }),
    );
  },
  async read(filePath) {
    try {
      const buffer = await fs.readFile(/* turbopackIgnore: true */ localPath(filePath));
      return { buffer, sha: blobSha(buffer), size: buffer.length };
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  },
  async write(filePath, buffer, { sha, author }) {
    const current = await this.read(filePath);
    if ((current?.sha ?? null) !== (sha ?? null)) throw new ConflictError();
    const full = localPath(filePath);
    await fs.mkdir(/* turbopackIgnore: true */ path.dirname(full), { recursive: true });
    const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(/* turbopackIgnore: true */ tmp, buffer);
    await fs.rename(/* turbopackIgnore: true */ tmp, full);
    await setAuthor(filePath, author);
  },
  async remove(filePath, { sha }) {
    const current = await this.read(filePath);
    if (!current) return;
    if (sha && current.sha !== sha) throw new ConflictError();
    await fs.unlink(/* turbopackIgnore: true */ localPath(filePath));
    await setAuthor(filePath, null);
  },
  async lastChange(filePath) {
    try {
      const stat = await fs.stat(/* turbopackIgnore: true */ localPath(filePath));
      const authors = await readAuthors(path.posix.dirname(filePath));
      return { date: stat.mtime.toISOString(), author: authors[path.posix.basename(filePath)] ?? null };
    } catch {
      return null;
    }
  },
  async lastChanges(filePaths) {
    const entries = await Promise.all(filePaths.map(async (p) => [p, await this.lastChange(p)]));
    return new Map(entries.filter(([, v]) => v));
  },
};

// ---------------------------------------------------------------------------
// GitHub (repositório privado)
// ---------------------------------------------------------------------------

const GH_ROOT = (process.env.GITHUB_FILES_PATH || "documentos").replace(/^\/+|\/+$/g, "");
const ref = `ref=${encodeURIComponent(GH_BRANCH)}`;

function ghPath(filePath) {
  return `${GH_ROOT}/${filePath}`;
}

// O autor do commit é o membro logado; o committer continua sendo o dono do
// token. O e-mail é fictício (o GitHub só exige que seja um e-mail válido).
function commitAuthor(author) {
  if (!author) return {};
  return { author: { name: author.name, email: `cim-${author.cim}@calendar-check.invalid` } };
}

const githubBackend = {
  async list(folder) {
    const res = await gh(`${contentsUrl(ghPath(folder))}?${ref}`);
    if (res.status === 404) {
      await ensureBranchAccessible();
      return [];
    }
    if (!res.ok) throw await githubError("read", res);
    const body = await res.json();
    if (!Array.isArray(body)) return [];
    return body
      .filter((e) => e.type === "file" && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, path: `${folder}/${e.name}`, size: e.size, sha: e.sha }));
  },
  async read(filePath) {
    const res = await gh(`${contentsUrl(ghPath(filePath))}?${ref}`);
    if (res.status === 404) return null;
    if (!res.ok) throw await githubError("read", res);
    const body = await res.json();
    if (Array.isArray(body) || body.type !== "file") return null;

    // Até 1 MB o conteúdo vem junto; acima disso, busca o blob (até 100 MB).
    if (body.encoding === "base64" && body.content) {
      return { buffer: Buffer.from(body.content, "base64"), sha: body.sha, size: body.size };
    }
    const blob = await gh(`/git/blobs/${body.sha}`, {
      headers: { Accept: "application/vnd.github.raw+json" },
    });
    if (!blob.ok) throw await githubError("read", blob);
    return { buffer: Buffer.from(await blob.arrayBuffer()), sha: body.sha, size: body.size };
  },
  async write(filePath, buffer, { sha, message, author }) {
    const res = await gh(contentsUrl(ghPath(filePath)), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: buffer.toString("base64"),
        branch: GH_BRANCH,
        ...(sha ? { sha } : {}),
        ...commitAuthor(author),
      }),
    });
    if (!res.ok) await throwWriteError(res);
  },
  async remove(filePath, { sha, message, author }) {
    if (!sha) {
      const current = await this.read(filePath);
      if (!current) return;
      sha = current.sha;
    }
    const res = await gh(contentsUrl(ghPath(filePath)), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sha, branch: GH_BRANCH, ...commitAuthor(author) }),
    });
    if (res.status === 404) return;
    if (!res.ok) await throwWriteError(res);
  },
  async lastChange(filePath) {
    const query = `path=${encodeURIComponent(ghPath(filePath))}&sha=${encodeURIComponent(GH_BRANCH)}&per_page=1`;
    const res = await gh(`/commits?${query}`);
    if (!res.ok) return null;
    const [commit] = await res.json();
    if (!commit) return null;
    return { date: commit.commit.author.date, author: commit.commit.author.name };
  },
  // Último commit de vários arquivos numa só consulta GraphQL (em vez de uma
  // requisição REST por arquivo), em lotes de 50.
  async lastChanges(filePaths) {
    const result = new Map();
    const [owner, name] = GH_REPO.split("/");
    for (let i = 0; i < filePaths.length; i += 50) {
      const batch = filePaths.slice(i, i + 50);
      const vars = Object.fromEntries(batch.map((p, j) => [`p${j}`, ghPath(p)]));
      const query = `query($owner: String!, $name: String!, $ref: String!, ${batch
        .map((_, j) => `$p${j}: String!`)
        .join(", ")}) {
        repository(owner: $owner, name: $name) {
          object(expression: $ref) {
            ... on Commit {
              ${batch
                .map((_, j) => `f${j}: history(first: 1, path: $p${j}) { nodes { author { name date } } }`)
                .join("\n")}
            }
          }
        }
      }`;
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "calendar-check",
        },
        body: JSON.stringify({ query, variables: { owner, name, ref: GH_BRANCH, ...vars } }),
      });
      if (!res.ok) throw await githubError("read", res);
      const body = await res.json();
      const commit = body.data?.repository?.object;
      if (!commit) {
        if (body.errors) throw new Error(`GitHub GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
        continue;
      }
      batch.forEach((p, j) => {
        const author = commit[`f${j}`]?.nodes?.[0]?.author;
        if (author) result.set(p, { date: author.date, author: author.name });
      });
    }
    return result;
  },
};

// ---------------------------------------------------------------------------

const backend = useGitHub ? githubBackend : localBackend;

/** Arquivos (não pastas) de `folder`: [{ name, path, size, sha }]. */
export function listFiles(folder) {
  return backend.list(folder);
}

/** { buffer, sha, size } ou null se não existir. */
export function readFile(filePath) {
  return backend.read(filePath);
}

/**
 * Grava `buffer`. `sha` é a versão que está sendo substituída (null = criar).
 * Lança ConflictError se o arquivo mudou (ou passou a existir) nesse meio-tempo.
 */
export function writeFile(filePath, buffer, { sha = null, message, author } = {}) {
  return backend.write(filePath, buffer, { sha, message, author });
}

export function deleteFile(filePath, { sha = null, message, author } = {}) {
  return backend.remove(filePath, { sha, message, author });
}

/** { date, author } da última alteração, ou null. */
export function lastChange(filePath) {
  return backend.lastChange(filePath).catch(() => null);
}

/** Map(caminho → { date, author }) para vários arquivos. Falha → Map vazio. */
export function lastChanges(filePaths) {
  if (filePaths.length === 0) return Promise.resolve(new Map());
  return backend.lastChanges(filePaths).catch((err) => {
    console.error(err);
    return new Map();
  });
}
