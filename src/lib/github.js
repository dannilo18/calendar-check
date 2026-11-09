import "server-only";

// Cliente mínimo da API do GitHub, usado para gravar dados num repositório
// PRIVADO (agenda e documentos). Só fica ativo com GITHUB_TOKEN + GITHUB_REPO.

export const GH_REPO = process.env.GITHUB_REPO; // "dono/repositorio"
export const GH_BRANCH = process.env.GITHUB_BRANCH || "main";
export const useGitHub = !!(process.env.GITHUB_TOKEN && GH_REPO);

export class ConflictError extends Error {}

export async function gh(url, init = {}) {
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

export function contentsUrl(filePath) {
  return `/contents/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

// Transforma uma resposta de erro do GitHub numa mensagem que diz o que
// corrigir na configuração.
export async function githubError(op, res) {
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
export async function ensureBranchAccessible() {
  if (branchChecked) return;
  const res = await gh(`/branches/${encodeURIComponent(GH_BRANCH)}`);
  if (!res.ok) throw await githubError("read", res);
  branchChecked = true;
}

// 409: sha desatualizado. 422 com "sha": arquivo criado/alterado por outra
// escrita no meio. Os dois são conflito de concorrência.
export async function throwWriteError(res) {
  if (res.status === 409) throw new ConflictError();
  const err = await githubError("write", res);
  if (res.status === 422 && /sha/i.test(err.message)) throw new ConflictError();
  throw err;
}
