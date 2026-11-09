// Acervo da chapa: duas pastas, cada uma com um tipo de arquivo.
// Arquivo compartilhado entre servidor e cliente (sem segredos aqui).

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // limite de corpo da Vercel: 4,5 MB

export const CATEGORIES = {
  decisoes: {
    folder: "decisoes",
    label: "Documentos de decisão",
    extensions: { md: "text/markdown; charset=utf-8" },
  },
  "identidade-visual": {
    folder: "identidade-visual",
    label: "Identidade visual",
    typeLabel: "imagem (PNG, JPG, WEBP, GIF ou SVG)",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg",
    extensions: {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
    },
  },
};

export function extensionOf(fileName) {
  const match = /\.([^.]+)$/.exec(String(fileName));
  return match ? match[1].toLowerCase() : "";
}

export function baseName(fileName) {
  return String(fileName).replace(/\.[^.]+$/, "");
}

export function contentTypeFor(category, fileName) {
  return CATEGORIES[category]?.extensions[extensionOf(fileName)] ?? null;
}

// O nome do arquivo é o próprio título (com acentos e espaços). Tira só o que
// quebraria um caminho ou uma URL; devolve null se não sobrar nada.
export function cleanName(name) {
  const cleaned = String(name ?? "")
    .replace(/[\\/:*?"<>|%#\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120);
  return cleaned || null;
}

// Nome de arquivo vindo de URL/form: nada de barras, ".." ou controle.
export function isSafeFileName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 200 &&
    !/[\\/\u0000-\u001f]/.test(name) &&
    !/^\.+$/.test(name)
  );
}

// Link público para servir o arquivo (rota protegida /arquivos/...).
export function fileUrl(category, fileName, { download = false } = {}) {
  const url = `/arquivos/${category}/${encodeURIComponent(fileName)}`;
  return download ? `${url}?baixar=1` : url;
}

export function docUrl(name, suffix = "") {
  return `/documentos/${encodeURIComponent(name)}${suffix}`;
}

// Parâmetro de rota → nome. Nomes nunca têm "%", então se aparecer um é
// porque o valor ainda está codificado.
export function paramToName(param) {
  const value = String(param ?? "");
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// Data e hora no fuso de Teresina (o servidor da Vercel roda em UTC).
export function formatDateTime(value, { long = false } = {}) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: long ? "long" : "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
